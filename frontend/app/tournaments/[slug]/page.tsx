"use client";

import { use, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  CalendarBlankIcon,
  ClockIcon,
  EnvelopeSimpleIcon,
  GameControllerIcon,
  GearSixIcon,
  GlobeHemisphereWestIcon,
  LinkSimpleIcon,
  PhoneIcon,
  SealCheckIcon,
  ShieldCheckIcon,
  TrophyIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import { clearSession, useAuth } from "@/features/auth/store";
import { accentVars } from "@/features/games/game-accent";
import RosterSummary from "@/features/games/components/RosterSummary";
import { gamePositionLabel } from "@/features/games/position-labels";
import { formatLocalizedDate } from "@/features/locale/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { teamsApi } from "@/features/teams/api";
import StatusBadge from "@/features/teams/components/StatusBadge";
import type { TeamWithMembers } from "@/features/teams/types";
import { tournamentsApi } from "@/features/tournaments/api";
import { getTournamentBannerUrl } from "@/features/tournaments/banner";
import PublicCompetitionView from "@/features/tournaments/components/competition/PublicCompetitionView";
import type { TournamentDetail } from "@/features/tournaments/types";
import { ApiError } from "@/lib/api/client";

const statusTone: Record<TournamentDetail["status"], string> = {
  DRAFT: "border-line bg-surface-sub text-ink-muted",
  REGISTRATION: "border-approved/35 bg-approved/12 text-approved",
  ONGOING: "border-brand/35 bg-brand/12 text-brand",
  COMPLETED: "border-accent/35 bg-accent/12 text-accent",
  CANCELLED: "border-rejected/35 bg-rejected/12 text-rejected",
};

function EventCard({
  title,
  icon,
  children,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="border border-line bg-surface-card/90 p-5 shadow-[0_12px_30px_rgb(0_0_0/0.12)] sm:p-6">
      <div className="flex items-center gap-3">
        <span className="grid size-9 place-items-center border border-accent/25 bg-accent/10 text-accent">
          {icon}
        </span>
        <h2 className="text-lg font-bold text-ink">{title}</h2>
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="min-w-0 border-l-2 border-accent/45 pl-3">
      <dt className="text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-faint">
        {label}
      </dt>
      <dd className="mt-1 text-sm font-semibold text-ink">{value}</dd>
    </div>
  );
}

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
      .then((result) => {
        if (!cancelled) setTournament(result);
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        if (reason instanceof ApiError && reason.status === 401) clearSession();
        setError(
          reason instanceof Error
            ? reason.message
            : t("tournament.detail.loadError"),
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
        if (!cancelled) {
          setMyTeam(
            teams.find((team) => team.tournament.slug === slug) ?? null,
          );
        }
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
      <div className="mx-auto w-full max-w-7xl flex-1 px-4 py-10">
        <div aria-hidden className="space-y-4">
          <div className="aspect-[16/6] animate-pulse bg-surface-card" />
          <div className="h-44 animate-pulse bg-surface-card" />
        </div>
      </div>
    );
  }

  if (error || !tournament) {
    return (
      <div className="mx-auto w-full max-w-2xl flex-1 px-4 py-16 text-center">
        <p className={alertErrorClass}>
          {error || t("tournament.detail.notFound")}
        </p>
        <Link
          href="/tournaments"
          className="mt-4 inline-block text-sm text-brand hover:underline"
        >
          {t("tournament.detail.backToList")}
        </Link>
      </div>
    );
  }

  const isOrganizer = Boolean(
    user && tournament.organizer?.id === user.id,
  );
  const ownTeam = user ? myTeam : null;
  const canRegister = Boolean(
    user && tournament.registrationOpen && !ownTeam,
  );
  const displayGameName =
    tournament.displayGameName ?? tournament.game.name;
  const bannerUrl = getTournamentBannerUrl(
    tournament.bannerUrl,
    tournament.game.name,
    tournament.game.code,
  );
  const fallbackBanner = getTournamentBannerUrl(
    null,
    tournament.game.name,
    tournament.game.code,
  );
  const formatDateTime = (value: string) =>
    formatLocalizedDate(value, locale, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  const eventDates = tournament.startDate
    ? tournament.endDate
      ? `${formatLocalizedDate(tournament.startDate, locale)} — ${formatLocalizedDate(tournament.endDate, locale)}`
      : formatLocalizedDate(tournament.startDate, locale)
    : t("common.notSet");
  const hasContact = Boolean(
    tournament.contactEmail ||
      tournament.contactPhone ||
      tournament.contactLink,
  );

  return (
    <div
      style={accentVars(tournament.game.name)}
      className="tournament-detail-page w-full flex-1 pb-16"
    >
      <div className="mx-auto w-full max-w-7xl px-4 pt-6 sm:px-6 lg:px-8">
        <Link
          href="/tournaments"
          className="inline-flex items-center gap-2 text-sm text-ink-muted transition hover:text-ink"
        >
          <ArrowLeftIcon size={16} />
          {t("tournament.detail.backToList")}
        </Link>
      </div>

      <div className="mx-auto mt-5 w-full max-w-[100rem] px-0 sm:px-4">
        <header className="overflow-hidden border-y border-line bg-surface-card sm:border-x">
          <div className="relative aspect-[16/6] min-h-64 overflow-hidden bg-surface-sub sm:min-h-80">
            <ResolvedImage
              src={bannerUrl}
              fallbackSrc={fallbackBanner}
              alt={`${t("tournament.detail.bannerAlt")} ${tournament.name}`}
              className="absolute inset-0 size-full object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/5 to-slate-950/25" />
            <div className="absolute inset-x-0 bottom-0 h-28 bg-gradient-to-t from-surface-card/95 to-transparent" />

            <div className="absolute left-4 top-4 flex flex-wrap gap-2 sm:left-6 sm:top-6">
              <span
                className={`border px-3 py-1.5 text-xs font-bold backdrop-blur-md ${statusTone[tournament.status]}`}
              >
                {t(
                  `tournament.status.${tournament.status}` as TranslationKey,
                )}
              </span>
              {tournament.isVerified && (
                <span className="inline-flex items-center gap-1.5 border border-approved/35 bg-slate-950/65 px-3 py-1.5 text-xs font-bold text-approved backdrop-blur-md">
                  <SealCheckIcon size={14} weight="fill" />
                  {t("tournament.detail.verified")}
                </span>
              )}
            </div>
          </div>

          <div className="grid gap-7 border-t border-line px-4 py-6 sm:px-7 lg:grid-cols-[minmax(0,1.5fr)_minmax(20rem,0.65fr)] lg:items-center lg:px-10">
            <div className="flex min-w-0 items-start gap-4 sm:gap-6">
              <span className="grid size-20 shrink-0 place-items-center overflow-hidden border border-line bg-surface-sub text-accent shadow-xl sm:size-28">
                <ResolvedImage
                  src={tournament.game.iconUrl}
                  alt=""
                  className="size-full object-cover object-center"
                  fallback={<GameControllerIcon size={42} weight="duotone" />}
                />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-accent">
                  {displayGameName}
                </p>
                <h1 className="mt-2 text-2xl font-black leading-tight tracking-tight text-ink sm:text-4xl">
                  {tournament.name}
                </h1>
                <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-ink-muted">
                  <span className="inline-flex items-center gap-2">
                    <CalendarBlankIcon className="text-accent" size={17} />
                    {eventDates}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <GlobeHemisphereWestIcon
                      className="text-accent"
                      size={17}
                    />
                    {t(
                      `tournament.mode.${tournament.mode}` as TranslationKey,
                    )}
                  </span>
                </div>
              </div>
            </div>

            <div className="border-l-2 border-accent/55 pl-5 lg:text-right">
              <p
                className={`font-bold ${
                  tournament.registrationOpen
                    ? "text-approved"
                    : "text-ink-muted"
                }`}
              >
                {tournament.registrationOpen
                  ? t("tournament.detail.registrationOpen")
                  : t("tournament.detail.registrationClosed")}
              </p>
              <p className="mt-1 text-sm text-ink-muted">
                {tournament.registrationDeadline
                  ? `${t("tournament.detail.registrationUntil")} ${formatDateTime(tournament.registrationDeadline)}`
                  : t("tournament.detail.registrationNoDeadline")}
              </p>
              <div className="mt-4 flex flex-wrap gap-2 lg:justify-end">
                {isOrganizer && (
                  <Link
                    href={`/tournaments/${slug}/manage`}
                    className={secondaryButtonClass}
                  >
                    <GearSixIcon size={17} />
                    {t("tournament.detail.manage")}
                  </Link>
                )}
                {canRegister && (
                  <Link
                    href={`/tournaments/${slug}/register-team`}
                    className="inline-flex min-h-[var(--control-height)] items-center justify-center bg-accent px-7 py-3 text-sm font-bold text-on-accent transition hover:brightness-110"
                  >
                    {t("tournament.detail.registerTeam")}
                  </Link>
                )}
              </div>
            </div>
          </div>

          <nav
            aria-label={t("tournament.detail.sectionNavigation")}
            className="overflow-x-auto border-t border-line bg-surface-card/95 px-4 sm:px-8"
          >
            <div className="flex min-w-max gap-1">
              <a href="#overview" className="tournament-detail-tab">
                {t("tournament.detail.overview")}
              </a>
              <a href="#competition" className="tournament-detail-tab">
                {t("tournament.detail.competition")}
              </a>
              <a href="#participants" className="tournament-detail-tab">
                {t("tournament.detail.participants")}
              </a>
              {tournament.rules && (
                <a href="#rules" className="tournament-detail-tab">
                  {t("tournament.detail.rules")}
                </a>
              )}
            </div>
          </nav>
        </header>
      </div>

      <main className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
        <section
          id="overview"
          className="scroll-mt-28 py-10 lg:grid lg:grid-cols-[minmax(0,1.55fr)_minmax(19rem,0.72fr)] lg:gap-7"
        >
          <div className="space-y-6">
            <EventCard
              title={t("tournament.detail.information")}
              icon={<ShieldCheckIcon size={19} weight="duotone" />}
            >
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <Fact label={t("tournament.detail.game")} value={displayGameName} />
                <Fact
                  label={t("tournament.detail.mode")}
                  value={t(
                    `tournament.mode.${tournament.mode}` as TranslationKey,
                  )}
                />
                <Fact
                  label={t("tournament.detail.capacity")}
                  value={`${tournament._count?.teams ?? 0}${
                    tournament.maxTeams ? ` / ${tournament.maxTeams}` : ""
                  } ${t("tournament.detail.teamsUnit")}`}
                />
                <Fact
                  label={t("tournament.detail.roster")}
                  value={`${tournament.minTeamSize}–${tournament.maxTeamSize} ${t("tournament.detail.playersUnit")}`}
                />
                <Fact
                  label={t("tournament.detail.visibility")}
                  value={t(
                    `tournament.visibility.${tournament.visibility}` as TranslationKey,
                  )}
                />
                <Fact
                  label={t("tournament.detail.location")}
                  value={
                    tournament.location ||
                    (tournament.mode === "ONLINE"
                      ? t("tournament.detail.online")
                      : t("common.notSet"))
                  }
                />
              </dl>

              {tournament.description && (
                <div className="mt-7 border-t border-line pt-6">
                  <h3 className="font-bold text-ink">
                    {t("tournament.detail.about")}
                  </h3>
                  <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-ink-muted">
                    {tournament.description}
                  </p>
                </div>
              )}

              <div className="mt-7 border-t border-line pt-6">
                <h3 className="font-bold text-ink">
                  {t("tournament.detail.teamStructure")}
                </h3>
                <div className="mt-4">
                  <RosterSummary
                    activeSize={tournament.minTeamSize}
                    maxRosterSize={tournament.maxTeamSize}
                  />
                </div>
                {tournament.game.positionMode !== "NONE" &&
                  (tournament.game.positions?.length ?? 0) > 0 && (
                    <div className="mt-5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
                        {tournament.game.positionMode === "FIXED"
                          ? t("game.structure.requiredPositions")
                          : t("game.structure.optionalPositions")}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {tournament.game.positions?.map((position) => (
                          <span
                            key={position}
                            className="border border-line bg-surface-sub px-3 py-1 text-xs text-ink-muted"
                          >
                            {gamePositionLabel(position, locale)}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              <div className="mt-7 flex items-center gap-3 border-t border-line pt-6">
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-sm font-bold text-on-accent">
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
                <div>
                  <p className="text-xs text-ink-faint">
                    {t("tournament.detail.organizedBy")}
                  </p>
                  <p className="font-bold text-ink">
                    {tournament.organizer?.displayName}
                  </p>
                </div>
              </div>
            </EventCard>

            {ownTeam && (
              <EventCard
                title={t("tournament.detail.yourTeam")}
                icon={<UsersThreeIcon size={19} weight="duotone" />}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-bold text-ink">{ownTeam.name}</p>
                    <p className="mt-1 text-sm text-ink-muted">
                      {ownTeam._count?.members ?? 0}{" "}
                      {t("tournament.detail.members")}
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
              </EventCard>
            )}
          </div>

          <aside className="mt-6 space-y-6 lg:mt-0">
            <EventCard
              title={t("tournament.detail.schedule")}
              icon={<CalendarBlankIcon size={19} weight="duotone" />}
            >
              <dl className="space-y-5 text-sm">
                <Fact
                  label={t("tournament.detail.tournamentDates")}
                  value={eventDates}
                />
                <Fact
                  label={t("tournament.detail.registrationStarts")}
                  value={
                    tournament.registrationStartDate
                      ? formatDateTime(tournament.registrationStartDate)
                      : t("common.notSet")
                  }
                />
                <Fact
                  label={t("tournament.detail.registrationDeadline")}
                  value={
                    tournament.registrationDeadline
                      ? formatDateTime(tournament.registrationDeadline)
                      : t("tournament.detail.registrationNoDeadline")
                  }
                />
              </dl>
            </EventCard>

            {tournament.prizePool && (
              <EventCard
                title={t("tournament.detail.rewards")}
                icon={<TrophyIcon size={19} weight="duotone" />}
              >
                <p className="whitespace-pre-wrap text-sm leading-7 text-ink-muted">
                  {tournament.prizePool}
                </p>
              </EventCard>
            )}

            {hasContact && (
              <EventCard
                title={t("tournament.detail.contact")}
                icon={<EnvelopeSimpleIcon size={19} weight="duotone" />}
              >
                <ul className="space-y-3 text-sm">
                  {tournament.contactEmail && (
                    <li>
                      <a
                        href={`mailto:${tournament.contactEmail}`}
                        className="flex items-center gap-3 text-ink-muted transition hover:text-accent"
                      >
                        <EnvelopeSimpleIcon size={17} />
                        <span className="min-w-0 break-all">
                          {tournament.contactEmail}
                        </span>
                      </a>
                    </li>
                  )}
                  {tournament.contactPhone && (
                    <li>
                      <a
                        href={`tel:${tournament.contactPhone}`}
                        className="flex items-center gap-3 text-ink-muted transition hover:text-accent"
                      >
                        <PhoneIcon size={17} />
                        {tournament.contactPhone}
                      </a>
                    </li>
                  )}
                  {tournament.contactLink && (
                    <li>
                      <a
                        href={tournament.contactLink}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-3 text-ink-muted transition hover:text-accent"
                      >
                        <LinkSimpleIcon size={17} />
                        <span className="min-w-0 truncate">
                          {tournament.contactLink}
                        </span>
                      </a>
                    </li>
                  )}
                </ul>
              </EventCard>
            )}

            <div className="border border-line bg-surface-sub/75 p-5 text-sm text-ink-muted">
              <div className="flex items-start gap-3">
                <ClockIcon className="mt-0.5 shrink-0 text-accent" size={18} />
                <p>
                  {tournament.rounds?.length ?? 0}{" "}
                  {t("tournament.detail.stagesConfigured")}
                </p>
              </div>
            </div>
          </aside>
        </section>

        <PublicCompetitionView
          id="competition"
          slug={slug}
          tournamentId={tournament.id}
        />

        <section
          id="participants"
          className="mt-8 scroll-mt-28 border border-line bg-surface-card/90 p-5 sm:p-7"
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
                {t("tournament.detail.community")}
              </p>
              <h2 className="mt-1 text-2xl font-black text-ink">
                {t("tournament.detail.approvedTeams")}
              </h2>
            </div>
            <p className="text-sm text-ink-muted">
              {tournament.teams.length}{" "}
              {t("tournament.detail.teamsUnit")}
            </p>
          </div>

          {tournament.teams.length === 0 ? (
            <div className="mt-6 border border-dashed border-line px-4 py-12 text-center">
              <UsersThreeIcon
                size={30}
                className="mx-auto text-ink-faint"
                weight="duotone"
              />
              <p className="mt-3 text-sm text-ink-muted">
                {t("tournament.detail.noApprovedTeams")}
              </p>
              {!user && (
                <p className="mt-1 text-sm text-ink-faint">
                  <Link href="/login" className="text-accent hover:underline">
                    {t("auth.login.submit")}
                  </Link>{" "}
                  {t("tournament.detail.loginToRegister")}
                </p>
              )}
            </div>
          ) : (
            <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {tournament.teams.map((team) => (
                <li
                  key={team.id}
                  className="flex items-center gap-3 border border-line bg-surface-sub/70 p-4 transition hover:border-accent/45"
                >
                  <span className="grid size-12 shrink-0 place-items-center overflow-hidden border border-line bg-surface-card font-bold text-accent">
                    <ResolvedImage
                      src={team.logoUrl}
                      alt={`${t("tournament.detail.teamLogoAlt")} ${team.name}`}
                      className="size-full object-cover object-center"
                      fallback={team.name.charAt(0).toUpperCase()}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-bold text-ink">
                      {team.name}
                    </span>
                    <span className="mt-1 block truncate text-xs text-ink-faint">
                      {team.captain?.displayName} · {team._count?.members ?? 0}{" "}
                      {t("tournament.detail.members")}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {tournament.rules && (
          <section
            id="rules"
            className="mt-8 scroll-mt-28 border border-line bg-surface-card/90 p-5 sm:p-7"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              {t("tournament.detail.competitionPolicy")}
            </p>
            <h2 className="mt-1 text-2xl font-black text-ink">
              {t("tournament.detail.rules")}
            </h2>
            <p className="mt-5 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-ink-muted">
              {tournament.rules}
            </p>
          </section>
        )}
      </main>
    </div>
  );
}
