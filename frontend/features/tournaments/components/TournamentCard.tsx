import Link from "next/link";
import {
  CalendarBlankIcon,
  CrownIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import type { Tournament } from "@/features/tournaments/types";
import { getTournamentBannerUrl } from "@/features/tournaments/banner";
import type { TournamentView } from "@/features/tournaments/components/TournamentGrid";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { formatLocalizedDate } from "@/features/locale/format";
import ResolvedImage from "@/components/ResolvedImage";
import GameIcon from "@/features/games/components/GameIcon";
import TournamentFavoriteButton from "@/features/tournaments/components/TournamentFavoriteButton";
import type { TournamentFavoriteMutationResult } from "@/features/tournaments/types";

const statusLabels: Record<Tournament["status"], TranslationKey> = {
  DRAFT: "tournaments.discovery.draft",
  REGISTRATION: "tournaments.discovery.registration",
  ONGOING: "tournaments.discovery.ongoing",
  COMPLETED: "tournaments.discovery.completed",
  CANCELLED: "tournaments.discovery.cancelled",
};

const statusClasses: Record<Tournament["status"], string> = {
  DRAFT: "tournament-status-DRAFT border-line bg-surface/85 text-ink-muted",
  REGISTRATION:
    "tournament-status-REGISTRATION border-sky-300/40 bg-black/80 text-sky-200",
  ONGOING:
    "tournament-status-ONGOING border-emerald-300/40 bg-black/80 text-emerald-200",
  COMPLETED:
    "tournament-status-COMPLETED border-line bg-surface/85 text-ink-muted",
  CANCELLED:
    "tournament-status-CANCELLED border-rose-300/40 bg-black/80 text-rose-200",
};

export default function TournamentCard({
  tournament: t,
  view = "grid",
  href,
  showCreatedAt = false,
  onFavoriteOptimisticChange,
  onFavoriteReconciled,
  onFavoriteRollback,
  showFavoriteFeedback = true,
}: {
  tournament: Tournament;
  view?: TournamentView;
  href?: string;
  showCreatedAt?: boolean;
  onFavoriteOptimisticChange?: (
    state: TournamentFavoriteMutationResult,
  ) => void;
  onFavoriteReconciled?: (state: TournamentFavoriteMutationResult) => void;
  onFavoriteRollback?: (state: TournamentFavoriteMutationResult) => void;
  showFavoriteFeedback?: boolean;
}) {
  const { locale, t: translate } = useLocale();
  const formattedDate = t.startDate
    ? formatLocalizedDate(t.startDate, locale)
    : translate("tournament.card.dateUnknown");
  const teamCount = t._count?.teams ?? 0;
  const registrationProgress = t.maxTeams
    ? Math.min(100, Math.round((teamCount / t.maxTeams) * 100))
    : 0;
  const listView = view === "list";

  return (
    <article
      className={`tournament-card group relative overflow-hidden rounded-2xl border border-line bg-surface-sub transition-colors duration-200 hover:border-line-strong ${
        listView
          ? "grid sm:grid-cols-[18rem_minmax(0,1fr)]"
          : "flex h-full flex-col"
      }`}
    >
      <Link
        href={href ?? `/tournaments/${t.slug}`}
        aria-label={t.name}
        className="absolute inset-0 z-10 rounded-2xl focus-visible:outline-none focus-visible:shadow-[inset_0_0_0_3px_var(--color-accent)]"
      />
      <div
        className={`tournament-card-media relative overflow-hidden ${listView ? "tournament-card-media-list h-44 sm:h-full sm:min-h-52" : "h-44"}`}
      >
        <ResolvedImage
          src={getTournamentBannerUrl(t.bannerUrl, t.game?.name, t.game?.code)}
          fallbackSrc={getTournamentBannerUrl(null, t.game?.name, t.game?.code)}
          alt=""
          className="absolute inset-0 size-full object-cover object-center"
        />
        <div
          aria-hidden
          className="tournament-card-media-gradient absolute inset-0 bg-gradient-to-t from-surface-sub via-transparent to-black/10"
        />
        <span
          className={`tournament-status absolute left-4 top-4 rounded-md border px-2.5 py-1 text-xs font-bold shadow-sm backdrop-blur-md ${statusClasses[t.status]}`}
        >
          {translate(statusLabels[t.status])}
        </span>
        <TournamentFavoriteButton
          slug={t.slug}
          isFavorited={t.isFavorited}
          favoriteCount={t.favoriteCount}
          compact
          accentWhenActive
          className="!absolute !right-4 !top-4 !bottom-auto !left-auto z-20"
          onOptimisticChange={onFavoriteOptimisticChange}
          onReconciled={onFavoriteReconciled}
          onRollback={onFavoriteRollback}
          showFeedback={showFavoriteFeedback}
        />

        {t.isOfficial && (
          <span className="absolute bottom-3 left-4 inline-flex items-center gap-1.5 rounded-md border border-[#d8bd87]/40 bg-black/80 px-2.5 py-1 text-xs font-bold text-[#d8bd87] backdrop-blur-md">
            <CrownIcon size={14} weight="fill" />
            {translate("tournament.detail.official")}
          </span>
        )}
      </div>

      <div
        className={`flex flex-1 flex-col ${listView ? "p-5 sm:p-6" : "p-5"}`}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-lg font-bold text-ink">
            {t.name}
          </h3>
          {t.game && (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-accent/20 bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent">
              <GameIcon game={t.game} size={16} />
              {t.displayGameName ?? t.game.name}
            </span>
          )}
        </div>

        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-6 text-ink-muted">
          {t.description || translate("tournament.card.noDescription")}
        </p>

        {showCreatedAt && (
          <p className="mt-4 text-xs font-semibold text-accent">
            {translate("tournament.card.createdAt")}: {" "}
            {formatLocalizedDate(t.createdAt, locale)}
          </p>
        )}

        <div className="mt-5 flex items-center justify-between gap-3 border-t border-line/70 pt-4 text-xs text-ink-faint">
          <span className="inline-flex items-center gap-1.5">
            <UsersThreeIcon size={16} weight="duotone" />
            {teamCount} {translate("tournament.card.teams")}
            {t.maxTeams ? ` / ${t.maxTeams}` : ""}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarBlankIcon size={16} weight="duotone" />
            {formattedDate}
          </span>
        </div>

        {t.maxTeams && (
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-line">
            <div
              aria-hidden
              className="h-full rounded-full bg-accent transition-[width] duration-500"
              style={{ width: `${registrationProgress}%` }}
            />
          </div>
        )}
      </div>
    </article>
  );
}
