"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  GearSixIcon,
  SealCheckIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { useAuth } from "@/features/auth/store";
import { accentVars } from "@/features/games/game-accent";
import RosterSummary from "@/features/games/components/RosterSummary";
import { gamePositionLabel } from "@/features/games/position-labels";
import { teamsApi } from "@/features/teams/api";
import StatusBadge from "@/features/teams/components/StatusBadge";
import type { TeamWithMembers } from "@/features/teams/types";
import { tournamentsApi } from "@/features/tournaments/api";
import { getTournamentBannerUrl } from "@/features/tournaments/banner";
import type { TournamentDetail } from "@/features/tournaments/types";
import PublicCompetitionView from "@/features/tournaments/components/competition/PublicCompetitionView";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import ResolvedImage from "@/components/ResolvedImage";
import { formatLocalizedDate } from "@/features/locale/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";

export default function TournamentDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = use(params);
  const { user } = useAuth();
  const { locale, t } = useLocale();
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [myTeam, setMyTeam] = useState<TeamWithMembers | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    tournamentsApi
      .findBySlug(slug)
      .then((t) => {
        if (!cancelled) setTournament(t);
      })
      .catch((err) => {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : t("tournament.detail.loadError"),
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, t]);

  useEffect(() => {
    if (!tournament || !user) return;
    let cancelled = false;
    teamsApi
      .findMine()
      .then((teams) => {
        if (!cancelled)
          setMyTeam(
            teams.find((team) => team.tournament.slug === slug) ?? null,
          );
      })
      .catch(() => {
        if (!cancelled) setMyTeam(null);
      });
    return () => {
      cancelled = true;
    };
  }, [slug, tournament, user]);

  if (loading) {
    return (
      <div className="mx-auto w-full max-w-4xl flex-1 px-4 py-10">
        <div aria-hidden className="space-y-4">
          <div className="h-40 rounded-xl bg-surface-card" />
          <div className="h-32 rounded-xl bg-surface-card" />
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center">
        <p className={alertErrorClass}>{error || t("tournament.detail.notFound")}</p>
        <Link
          href="/"
          className="mt-4 inline-block text-sm text-brand hover:underline"
        >
          {t("tournament.detail.backToList")}
        </Link>
      </div>
    );
  }

  const isOrganizer = user && tournament.organizer?.id === user.id;
  const ownTeam = user ? myTeam : null;
  const canRegister = user && tournament.registrationOpen && !ownTeam;

  return (
    <div
      style={accentVars(tournament.game?.name)}
      className="mx-auto w-full max-w-6xl flex-1 px-4 py-10"
    >
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition hover:text-ink"
      >
        <ArrowLeftIcon size={16} />
        {t("tournament.detail.backToList")}
      </Link>

      <header className="mt-4 overflow-hidden rounded-xl border border-line border-t-2 border-t-accent bg-surface-card">
        <div className="relative aspect-[16/7] max-h-72 min-h-36 overflow-hidden sm:min-h-52">
          <ResolvedImage
            src={getTournamentBannerUrl(
              tournament.bannerUrl,
              tournament.game?.name,
              tournament.game?.code,
            )}
            fallbackSrc={getTournamentBannerUrl(
              null,
              tournament.game?.name,
              tournament.game?.code,
            )}
            alt={`${t("tournament.detail.bannerAlt")} ${tournament.name}`}
            className="absolute inset-0 size-full object-cover object-center"
          />
        </div>

        <div className="flex flex-wrap items-start justify-between gap-4 p-6 pb-0">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              {tournament.game && (
                <span className="rounded-full bg-accent/12 px-2.5 py-1 text-xs font-medium text-accent">
                  {tournament.displayGameName ?? tournament.game.name}
                </span>
              )}
              {tournament.isVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-approved/12 px-2.5 py-1 text-xs font-medium text-approved">
                  <SealCheckIcon size={13} weight="fill" />
                  {t("tournament.detail.verified")}
                </span>
              )}
            </div>
            <h1 className="mt-3 text-2xl font-bold tracking-tight text-ink sm:text-3xl">
              {tournament.name}
            </h1>
            <div className="mt-2 inline-flex items-center gap-2 text-sm text-ink-muted">
              <span className="grid size-7 shrink-0 place-items-center overflow-hidden rounded-full bg-brand text-xs font-bold text-on-brand">
                <ResolvedImage
                  src={tournament.organizer?.avatarUrl}
                  alt=""
                  className="size-full object-cover object-center"
                  fallback={
                    tournament.organizer?.displayName
                      ?.charAt(0)
                      .toUpperCase() || "?"
                  }
                />
              </span>
              <span>
                {t("tournament.detail.organizedBy")}{" "}
                <span className="font-medium text-ink">
                  {tournament.organizer?.displayName}
                </span>
              </span>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {isOrganizer && (
              <Link
                href={`/tournaments/${slug}/manage`}
                className={secondaryButtonClass}
              >
                <GearSixIcon size={16} />
                {t("tournament.detail.manage")}
              </Link>
            )}
            {canRegister && (
              <Link
                href={`/tournaments/${slug}/register-team`}
                className="inline-flex items-center justify-center rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent transition hover:opacity-90 active:translate-y-px"
              >
                {t("tournament.detail.registerTeam")}
              </Link>
            )}
          </div>
        </div>

        {tournament.description && (
          <p className="mx-6 mt-5 max-w-2xl text-ink-muted">
            {tournament.description}
          </p>
        )}

        <dl className="mx-6 mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-line pb-6 pt-5 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-xs text-ink-faint">{t("tournament.detail.registration")}</dt>
            <dd className="mt-1 font-medium text-ink">
              {tournament.registrationOpen ? t("tournament.detail.registrationOpen") : t("tournament.detail.registrationClosed")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">{t("tournament.detail.teamCount")}</dt>
            <dd className="mt-1 font-medium text-ink">
              {tournament._count?.teams ?? 0}
              {tournament.maxTeams ? ` / ${tournament.maxTeams}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">{t("tournament.detail.starts")}</dt>
            <dd className="mt-1 font-medium text-ink">
              {tournament.startDate
                ? formatLocalizedDate(tournament.startDate, locale)
                : t("common.notSet")}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-ink-faint">{t("tournament.detail.mode")}</dt>
            <dd className="mt-1 font-medium text-ink">
              {t(`tournament.mode.${tournament.mode}` as TranslationKey)}
            </dd>
          </div>
        </dl>
      </header>

      <section className="mt-6 rounded-xl border border-line bg-surface-card p-6">
        <h2 className="font-semibold text-ink">
          {t("game.structure.editorTitle")}
        </h2>
        <div className="mt-4">
          <RosterSummary
            activeSize={tournament.minTeamSize}
            maxRosterSize={tournament.maxTeamSize}
          />
        </div>
        {tournament.game.positionMode !== "NONE" &&
          (tournament.game.positions?.length ?? 0) > 0 && (
            <div className="mt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                {tournament.game.positionMode === "FIXED"
                  ? t("game.structure.requiredPositions")
                  : t("game.structure.optionalPositions")}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {tournament.game.positions?.map((position) => (
                  <span
                    key={position}
                    className="rounded-full border border-line bg-surface-sub px-3 py-1 text-xs text-ink-muted"
                  >
                    {gamePositionLabel(position, locale)}
                  </span>
                ))}
              </div>
            </div>
          )}
      </section>

      {ownTeam && (
        <section className="mt-6 rounded-xl border border-line bg-surface-card p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-ink">{t("tournament.detail.yourTeam")}</h2>
              <p className="mt-1 text-sm text-ink-muted">
                {ownTeam.name} • {ownTeam._count?.members ?? 0} {t("tournament.detail.members")}
              </p>
            </div>
            <StatusBadge status={ownTeam.status} />
          </div>
          {ownTeam.status === "PENDING" && (
            <p className="mt-4 text-sm text-ink-muted">
              {t("tournament.detail.pendingReview")}
            </p>
          )}
          {ownTeam.status === "REJECTED" && (
            <p className="mt-4 text-sm text-ink-muted">
              {t("tournament.detail.rejectedHelp")}
            </p>
          )}
        </section>
      )}

      {tournament.rules && (
        <section className="mt-6 rounded-xl border border-line bg-surface-card p-6">
          <h2 className="font-semibold text-ink">{t("tournament.detail.rules")}</h2>
          <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-ink-muted">
            {tournament.rules}
          </p>
        </section>
      )}

      <PublicCompetitionView slug={slug} tournamentId={tournament.id} />

      <section className="mt-6 rounded-xl border border-line bg-surface-card p-6">
        <h2 className="font-semibold text-ink">{t("tournament.detail.approvedTeams")}</h2>

        {tournament.teams.length === 0 ? (
          <div className="mt-4 rounded-lg border border-dashed border-line px-4 py-10 text-center">
            <UsersThreeIcon
              size={28}
              className="mx-auto text-ink-faint"
              weight="duotone"
            />
            <p className="mt-3 text-sm text-ink-muted">
              {t("tournament.detail.noApprovedTeams")}
            </p>
            {!user && (
              <p className="mt-1 text-sm text-ink-faint">
                <Link href="/login" className="text-brand hover:underline">
                  {t("auth.login.submit")}
                </Link>{" "}
                {t("tournament.detail.loginToRegister")}
              </p>
            )}
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {tournament.teams.map((team) => (
              <li
                key={team.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-line bg-surface-sub px-4 py-3"
              >
                <span className="grid size-11 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand/10 font-bold text-brand">
                  <ResolvedImage
                    src={team.logoUrl}
                    alt={`${t("tournament.detail.teamLogoAlt")} ${team.name}`}
                    className="size-full object-cover object-center"
                    fallback={team.name.charAt(0).toUpperCase()}
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-ink">
                    {team.name}
                  </span>
                  <span className="block text-xs text-ink-faint">
                    {team.captain?.displayName} • {team._count?.members ?? 0}{" "}
                    {t("tournament.detail.members")}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
