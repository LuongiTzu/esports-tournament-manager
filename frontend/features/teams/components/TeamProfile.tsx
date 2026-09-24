"use client";

import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowUpRightIcon,
  CalendarBlankIcon,
  CrownIcon,
  EnvelopeSimpleIcon,
  IdentificationCardIcon,
  PhoneIcon,
  ShieldCheckIcon,
  SwordIcon,
  TrophyIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import {
  formatLocalizedDate,
  formatLocalizedNumber,
} from "@/features/locale/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import type { TeamDetail } from "@/features/teams/types";
import type { User } from "@/features/auth/types";
import EmailVerificationNotice from "@/features/auth/components/EmailVerificationNotice";
import StatusBadge from "./StatusBadge";
import TeamManagementPanel from "./manage/TeamManagementPanel";
import TeamRoster from "./TeamRoster";
import TeamMatchHistory from "./TeamMatchHistory";
import styles from "./TeamProfile.module.css";

export default function TeamProfile({
  team,
  user,
  onChanged,
}: {
  team: TeamDetail;
  user: User | null;
  onChanged: (team?: TeamDetail) => Promise<void>;
}) {
  const { locale, t } = useLocale();
  const tournamentHref = `/tournaments/${encodeURIComponent(team.tournament.slug)}`;
  const canManageIdentity = Boolean(
    user &&
    (user.id === team.captainId || user.id === team.tournament.organizerId),
  );
  const stats: Array<{
    label: TranslationKey;
    value: number | null;
    tone: string;
  }> = [
    {
      label: "teamDetail.played",
      value: team.history.completedMatches,
      tone: "text-ink",
    },
    {
      label: "teamDetail.wins",
      value: team.history.wins,
      tone: "text-approved",
    },
    {
      label: "teamDetail.draws",
      value: team.history.draws,
      tone: "text-ink-muted",
    },
    {
      label: "teamDetail.losses",
      value: team.history.losses,
      tone: "text-rejected",
    },
    {
      label: "teamDetail.rank",
      value: team.history.finalRank,
      tone: "text-accent",
    },
  ];

  return (
    <div
      className={`${styles.page} mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-8`}
    >
      <title>{`${team.name} | ArenaVerse`}</title>
      <Link
        href={`${tournamentHref}#participants`}
        className="inline-flex max-w-full items-center gap-2 text-xs leading-5 text-ink-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        <ArrowLeftIcon aria-hidden size={15} className="shrink-0" />
        <span className="truncate">{team.tournament.name}</span>
      </Link>

      <header className={`${styles.hero} mt-5`}>
        <div className="px-5 pb-7 pt-6 sm:px-8 sm:pb-8 sm:pt-7">
          <div className="mb-6 flex items-center justify-between gap-3">
            <p className={`${styles.eyebrow} flex items-center gap-2`}>
              <ShieldCheckIcon size={15} aria-hidden />
              {t("teamDetail.title")}
            </p>
            <StatusBadge status={team.status} />
          </div>
          <div className="flex items-center gap-4 sm:gap-6">
            <span className={styles.emblem}>
              <ResolvedImage
                src={team.logoUrl}
                alt={team.name}
                className="size-full object-cover"
                fallback={team.name.charAt(0).toUpperCase()}
              />
            </span>
            <div className="min-w-0 flex-1">
              {team.shortName && (
                <p className="mb-1 break-words font-mono text-xs font-bold uppercase tracking-[0.2em] text-accent">
                  {team.shortName}
                </p>
              )}
              <h1 className="break-words text-2xl font-black leading-tight tracking-tight text-ink sm:text-4xl lg:text-[2.75rem]">
                {team.name}
              </h1>
              <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-xs text-ink-muted">
                <span className="inline-flex items-center gap-2">
                  <CrownIcon
                    size={15}
                    className="shrink-0 text-accent"
                    aria-hidden
                  />
                  {team.captain.displayName}
                </span>
                <span className="inline-flex items-center gap-2">
                  <UsersThreeIcon
                    size={15}
                    className="shrink-0 text-accent"
                    aria-hidden
                  />
                  {team.members.length} {t("myTeams.memberCount")}
                </span>
                <span className="inline-flex flex-wrap items-center gap-2">
                  <CalendarBlankIcon
                    size={15}
                    className="shrink-0 text-accent"
                    aria-hidden
                  />
                  {t("teamDetail.registeredOn")}{" "}
                  <time dateTime={team.registeredAt}>
                    {formatLocalizedDate(team.registeredAt, locale)}
                  </time>
                </span>
              </div>
            </div>
          </div>
        </div>
        <nav
          aria-label={t("teamDetail.navigation")}
          className={`${styles.navigation} flex flex-wrap items-center justify-between gap-x-4 border-t border-line bg-surface-card px-3 sm:px-6`}
        >
          <div className="flex flex-wrap">
            <a href="#team-roster" className="tournament-detail-tab gap-2">
              <UsersThreeIcon size={16} aria-hidden />
              {t("teamDetail.rosterTab")}
            </a>
            <a href="#team-history" className="tournament-detail-tab gap-2">
              <SwordIcon size={16} aria-hidden />
              {t("teamDetail.matchesTab")}
            </a>
            <a href="#team-info" className="tournament-detail-tab gap-2">
              <IdentificationCardIcon size={16} aria-hidden />
              {t("teamDetail.infoTab")}
            </a>
          </div>
          <Link
            href={`${tournamentHref}#competition`}
            className="mx-3 mb-3 inline-flex items-center gap-2 text-xs font-semibold text-accent hover:underline sm:my-3"
          >
            {t("teamDetail.viewCompetition")}
            <ArrowUpRightIcon size={16} aria-hidden />
          </Link>
        </nav>
      </header>

      <section
        aria-label={t("teamDetail.stats")}
        className="mt-5 border border-line bg-surface-card"
      >
        <dl className="grid grid-cols-6 sm:grid-cols-5">
          {stats.map(({ label, value, tone }, index) => (
            <div
              key={label}
              className={`px-4 py-4 sm:col-span-1 sm:px-6 sm:py-5 ${index < 3 ? "col-span-2 border-b border-line sm:border-b-0" : "col-span-3"} ${index === 4 ? "bg-accent/5" : ""} ${index > 0 ? "sm:border-l sm:border-line" : ""}`}
            >
              <dt className="flex items-center gap-2 text-xs text-ink-muted">
                {index === 4 && <TrophyIcon size={14} aria-hidden />}
                {t(label)}
              </dt>
              <dd
                className={`mt-2 font-mono text-3xl font-bold tracking-tight tabular-nums ${tone}`}
              >
                {value === null
                  ? "—"
                  : `${index === 4 ? "#" : ""}${formatLocalizedNumber(value, locale)}`}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {user && canManageIdentity && !user.emailVerifiedAt && (
        <EmailVerificationNotice email={user.email} className="mt-6" />
      )}

      <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem] xl:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="min-w-0 space-y-6">
          {user?.emailVerifiedAt && canManageIdentity ? (
            <TeamManagementPanel
              team={team}
              user={user}
              onChanged={onChanged}
            />
          ) : (
            <section
              id="team-roster"
              aria-labelledby="team-roster-title"
              className={`${styles.panel} p-5 sm:p-6`}
            >
              <p className={styles.eyebrow}>{t("teamDetail.rosterTab")}</p>
              <h2
                id="team-roster-title"
                className="mb-5 mt-1 text-xl font-bold text-ink"
              >
                {t("teamDetail.roster")}{" "}
                <span className="ml-2 font-mono text-sm font-normal text-ink-faint">
                  {team.members.length}
                </span>
              </h2>
              <TeamRoster
                members={team.members}
                sensitive={team.canViewSensitiveInfo}
              />
            </section>
          )}
          <TeamMatchHistory team={team} />
        </div>

        <aside
          id="team-info"
          aria-label={t("teamDetail.infoTab")}
          className="min-w-0 scroll-mt-24 space-y-5"
        >
          <section className={`${styles.panel} p-5`}>
            <p className={styles.eyebrow}>{t("teamDetail.infoTab")}</p>
            <h2 className="mt-1 text-lg font-bold text-ink">
              {t("teamDetail.about")}
            </h2>
            <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 text-ink-muted">
              {team.description || t("teamDetail.noDescription")}
            </p>
            <div className="mt-5 flex items-center gap-3 border-t border-line pt-5">
              <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border border-line bg-surface-sub font-bold text-accent">
                <ResolvedImage
                  src={team.captain.avatarUrl}
                  alt={team.captain.displayName}
                  className="size-full object-cover"
                  fallback={team.captain.displayName.charAt(0).toUpperCase()}
                />
              </span>
              <div className="min-w-0">
                <p className="text-[10px] text-ink-faint">
                  {t("teamDetail.captain")}
                </p>
                <p className="mt-1 break-words text-sm font-semibold text-ink">
                  {team.captain.displayName}
                </p>
              </div>
            </div>
          </section>

          <section className={`${styles.panel} overflow-hidden`}>
            <div className="flex items-center gap-2 border-b border-line bg-surface-sub px-5 py-3 text-xs font-semibold text-accent">
              <TrophyIcon size={16} aria-hidden />
              {t("teamDetail.tournament")}
            </div>
            <div className="p-5">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                {t(
                  `tournament.status.${team.tournament.status}` as TranslationKey,
                )}
              </p>
              <h2 className="mt-2 break-words text-base font-bold leading-6 text-ink">
                {team.tournament.name}
              </h2>
              <Link
                href={tournamentHref}
                className={`${styles.button} mt-5 w-full`}
              >
                {t("teamDetail.visitTournament")}
                <ArrowUpRightIcon size={16} aria-hidden />
              </Link>
            </div>
          </section>

          {team.canViewSensitiveInfo && (
            <section
              aria-labelledby="team-contact"
              className={`${styles.panel} p-5`}
            >
              <h2
                id="team-contact"
                className="flex items-center gap-2 text-base font-bold text-ink"
              >
                <IdentificationCardIcon
                  size={19}
                  className="text-accent"
                  aria-hidden
                />
                {t("registration.representative")}
              </h2>
              <dl className="mt-5 space-y-4 text-sm">
                <div>
                  <dt className="text-xs text-ink-faint">
                    {t("registration.fullName")}
                  </dt>
                  <dd className="mt-1 break-words text-ink">
                    {team.contactName}
                  </dd>
                </div>
                {team.contactEmail && (
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs text-ink-faint">
                      <EnvelopeSimpleIcon aria-hidden />
                      {t("common.email")}
                    </dt>
                    <dd className="mt-1 break-all text-ink">
                      {team.contactEmail}
                    </dd>
                  </div>
                )}
                {team.contactPhone && (
                  <div>
                    <dt className="flex items-center gap-1.5 text-xs text-ink-faint">
                      <PhoneIcon aria-hidden />
                      {t("registration.phone")}
                    </dt>
                    <dd className="mt-1 break-words text-ink">
                      {team.contactPhone}
                    </dd>
                  </div>
                )}
              </dl>
              <p className="mt-5 border-t border-line pt-3 text-xs leading-5 text-ink-faint">
                {t("teamDetail.privateContact")}
              </p>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
