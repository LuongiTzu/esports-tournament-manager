"use client";

import { useEffect, useMemo } from "react";
import {
  GameControllerIcon,
  TrophyIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { useLocale } from "@/features/locale/store";
import type { Game } from "@/features/games/types";
import { getTournamentBannerUrl } from "@/features/tournaments/banner";

interface TournamentLivePreviewProps {
  name: string;
  bannerFile: File | null;
  customGameName: string;
  selectedGame?: Game;
  maxTeams: string;
  prizePool: string;
  status: "DRAFT" | "REGISTRATION";
}

export default function TournamentLivePreview({
  name,
  bannerFile,
  customGameName,
  selectedGame,
  maxTeams,
  prizePool,
  status,
}: TournamentLivePreviewProps) {
  const { t } = useLocale();
  const localBannerUrl = useMemo(
    () => (bannerFile ? URL.createObjectURL(bannerFile) : null),
    [bannerFile],
  );

  useEffect(() => {
    return () => {
      if (localBannerUrl) URL.revokeObjectURL(localBannerUrl);
    };
  }, [localBannerUrl]);

  const displayGameName =
    selectedGame?.code === "CUSTOM"
      ? customGameName.trim() || t("tournament.create.previewGame")
      : selectedGame?.name || t("tournament.create.previewGame");
  const previewBanner =
    localBannerUrl ||
    getTournamentBannerUrl(
      null,
      selectedGame?.name,
      selectedGame?.code,
    );

  return (
    <aside className="tournament-create-preview lg:sticky lg:top-24">
      <div className="mb-4">
        <h2 className="text-sm font-bold text-ink">
          {t("tournament.create.livePreview")}
        </h2>
        <p className="mt-1 text-xs text-ink-faint">
          {t("tournament.create.livePreviewHint")}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-line bg-surface-card shadow-[0_1px_3px_rgb(15_23_42/0.05)]">
        <div className="relative h-44 overflow-hidden bg-surface-sub">
          <ResolvedImage
            src={previewBanner}
            alt=""
            className="absolute inset-0 size-full object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-surface-card via-transparent to-slate-950/10" />
          <span className="absolute left-3 top-3 rounded-md border border-line bg-surface-card/90 px-2.5 py-1 text-xs font-semibold text-ink-muted backdrop-blur">
            {status === "DRAFT"
              ? t("tournament.create.draft")
              : t("tournament.create.openRegistration")}
          </span>
          <span className="absolute bottom-3 right-3 grid size-12 place-items-center overflow-hidden rounded-xl border border-line bg-surface-card text-brand shadow-sm">
            <ResolvedImage
              src={selectedGame?.iconUrl}
              alt=""
              className="size-9 object-contain"
              fallback={<GameControllerIcon size={25} weight="duotone" />}
            />
          </span>
        </div>

        <div className="p-5">
          <p className="text-xs font-semibold text-brand">{displayGameName}</p>
          <h3 className="mt-2 text-xl font-bold leading-snug text-ink">
            {name.trim() || t("tournament.create.previewName")}
          </h3>
          <dl className="mt-5 grid gap-4 border-t border-line pt-4 text-sm">
            <div className="flex items-start gap-3">
              <UsersThreeIcon
                className="mt-0.5 shrink-0 text-brand"
                size={18}
                weight="duotone"
              />
              <div>
                <dt className="text-xs text-ink-faint">
                  {t("tournament.create.maxTeams")}
                </dt>
                <dd className="mt-0.5 font-semibold text-ink">
                  {maxTeams || t("common.unlimited")}
                </dd>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <TrophyIcon
                className="mt-0.5 shrink-0 text-brand"
                size={18}
                weight="duotone"
              />
              <div className="min-w-0">
                <dt className="text-xs text-ink-faint">
                  {t("tournament.create.previewPrize")}
                </dt>
                <dd className="mt-0.5 line-clamp-2 font-semibold text-ink">
                  {prizePool.trim() ||
                    t("tournament.create.previewPrizeEmpty")}
                </dd>
              </div>
            </div>
          </dl>
        </div>
      </div>
    </aside>
  );
}
