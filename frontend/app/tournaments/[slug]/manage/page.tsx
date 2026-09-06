"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, ShieldWarningIcon } from "@phosphor-icons/react";
import { useAuth } from "@/features/auth/store";
import EmailVerificationNotice from "@/features/auth/components/EmailVerificationNotice";
import { accentVars } from "@/features/games/game-accent";
import RegistrationManagement from "@/features/teams/components/manage/RegistrationManagement";
import { tournamentsApi } from "@/features/tournaments/api";
import CompetitionManager from "@/features/tournaments/components/manage/CompetitionManager";
import TournamentLifecycleControls from "@/features/tournaments/components/manage/TournamentLifecycleControls";
import TournamentGameEditor from "@/features/tournaments/components/manage/TournamentGameEditor";
import type { TournamentDetail } from "@/features/tournaments/types";
import { alertErrorClass } from "@/components/ui";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { adminApi } from "@/features/admin/api";
import type { AdminTournamentOverride } from "@/features/admin/types";

export default function ManagePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const router = useRouter();
  const { user, ready } = useAuth();
  const { t } = useLocale();

  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [adminOverride, setAdminOverride] =
    useState<AdminTournamentOverride | null>(null);
  const [endingOverride, setEndingOverride] = useState(false);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.push("/login");
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const loadedTournament = await tournamentsApi.findBySlug(slug);
        if (cancelled) return;
        if (loadedTournament.organizer?.id !== user.id) {
          if (user.role !== "ADMIN") {
            setLoadError(t("manage.notOrganizer"));
            return;
          }
          const activeOverride = await adminApi.getTournamentOverride(
            loadedTournament.id,
          );
          if (cancelled) return;
          if (!activeOverride || activeOverride.adminId !== user.id) {
            setLoadError(t("manage.overrideRequired"));
            return;
          }
          setAdminOverride(activeOverride);
        }
        setTournament(loadedTournament);
      } catch (err) {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : t("manage.loadError"),
        );
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [slug, router, ready, user, t]);

  const refreshTournament = async () => {
    setTournament(await tournamentsApi.findBySlug(slug));
  };

  const endAdminOverride = async () => {
    if (!tournament || !adminOverride || endingOverride) return;
    if (!window.confirm(t("admin.tournaments.endOverrideConfirm"))) return;
    setEndingOverride(true);
    try {
      await adminApi.endTournamentOverride(tournament.id);
      router.push("/admin/tournaments");
    } catch (reason) {
      setLoadError(
        reason instanceof Error
          ? reason.message
          : t("admin.tournaments.overrideError"),
      );
    } finally {
      setEndingOverride(false);
    }
  };

  if (ready && user?.emailVerifiedAt === null) {
    return (
      <div className="mx-auto flex w-full max-w-2xl flex-1 items-center px-4 py-16">
        <EmailVerificationNotice email={user.email} className="w-full" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <div aria-hidden className="space-y-3">
          <div className="h-9 w-1/2 rounded bg-surface-card" />
          <div className="h-24 rounded-xl bg-surface-card" />
          <div className="h-24 rounded-xl bg-surface-card" />
        </div>
      </div>
    );
  }

  if (loadError || !tournament) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center">
        <p className={alertErrorClass}>
          {loadError || t("tournament.detail.notFound")}
        </p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm text-brand hover:underline"
        >
          {t("tournament.detail.backToList")}
        </Link>
      </div>
    );
  }

  return (
    <div
      style={accentVars(tournament.game?.name)}
      className="tournament-detail-page w-full flex-1"
    >
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        <Link
          href={`/tournaments/${slug}`}
          className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink"
        >
          <ArrowLeftIcon size={16} />
          {tournament.name}
        </Link>

        <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
              {t("manage.eyebrow")}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {t("manage.title")} {tournament.name}
            </h1>
          </div>
          <span className="rounded-full border border-line bg-surface-card px-3 py-1.5 text-xs font-medium text-ink-muted">
            {t(`tournament.status.${tournament.status}` as TranslationKey)}
          </span>
        </div>

        {adminOverride && (
          <div className="mt-5 flex flex-col gap-3 rounded-xl border border-pending/35 bg-pending/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-start gap-3">
              <ShieldWarningIcon
                className="mt-0.5 shrink-0 text-pending"
                size={20}
                weight="fill"
              />
              <div className="min-w-0 text-sm">
                <p className="font-bold text-pending">
                  {t("manage.overrideActive")}
                </p>
                <p className="mt-1 break-words text-xs leading-5 text-ink-muted">
                  {adminOverride.reason}
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled={endingOverride}
              onClick={() => void endAdminOverride()}
              className="min-h-9 shrink-0 rounded-lg border border-pending/40 px-3 py-2 text-xs font-semibold text-pending hover:bg-pending/10 disabled:opacity-60"
            >
              {endingOverride
                ? t("admin.tournaments.endingOverride")
                : t("admin.tournaments.endOverride")}
            </button>
          </div>
        )}

        <div className="mt-8">
          <TournamentGameEditor
            tournament={tournament}
            onUpdated={setTournament}
          />
        </div>

        <div className="mt-6">
          <TournamentLifecycleControls
            tournament={tournament}
            onRefresh={refreshTournament}
          />
        </div>

        <div className="mt-6">
          <CompetitionManager
            tournament={tournament}
            onTournamentRefresh={refreshTournament}
          />
        </div>

        <div className="mt-12 border-t border-line pt-10">
          <RegistrationManagement
            tournament={tournament}
            onTournamentRefresh={refreshTournament}
          />
        </div>
      </div>
    </div>
  );
}
