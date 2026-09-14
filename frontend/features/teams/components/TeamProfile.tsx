"use client";

import Link from "next/link";
import { ArrowLeftIcon, UsersThreeIcon } from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { gamePositionLabel } from "@/features/games/position-labels";
import {
  formatLocalizedDate,
  formatLocalizedNumber,
} from "@/features/locale/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import type { TeamDetail, TeamMember } from "@/features/teams/types";
import type { User } from "@/features/auth/types";
import EmailVerificationNotice from "@/features/auth/components/EmailVerificationNotice";
import StatusBadge from "./StatusBadge";
import TeamManagementPanel from "./manage/TeamManagementPanel";

function MemberCard({
  member,
  sensitive,
}: {
  member: TeamMember;
  sensitive: boolean;
}) {
  const { locale, t } = useLocale();
  return (
    <li className="min-w-0 rounded-xl border border-line bg-surface-sub/45 p-4">
      <div className="flex items-start gap-3">
        <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-brand/10 font-bold text-brand">
          <ResolvedImage
            src={member.avatarUrl}
            alt={member.realName}
            className="size-full object-cover"
            fallback={(member.ign || member.realName).charAt(0).toUpperCase()}
          />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-semibold text-ink">
            {member.ign || member.realName}
          </h3>
          {member.ign && (
            <p className="break-words text-sm text-ink-muted">
              {member.realName}
            </p>
          )}
          <p className="mt-2 text-xs font-semibold text-brand">
            {t(`registration.role.${member.memberRole}` as TranslationKey)}
          </p>
          {member.position && (
            <p className="mt-1 text-xs text-ink-muted">
              {gamePositionLabel(member.position, locale)}
            </p>
          )}
        </div>
      </div>
      {sensitive &&
        (member.inGameId ||
          member.email ||
          member.phoneNumber ||
          member.birthDate ||
          member.gender) && (
          <dl className="mt-4 space-y-2 border-t border-line pt-3 text-sm">
            {member.inGameId && (
              <div>
                <dt className="text-ink-faint">{t("teamDetail.gameId")}</dt>
                <dd className="break-all">{member.inGameId}</dd>
              </div>
            )}
            {member.birthDate && (
              <div>
                <dt className="text-ink-faint">
                  {t("registration.birthDate")}
                </dt>
                <dd>{formatLocalizedDate(member.birthDate, locale)}</dd>
              </div>
            )}
            {member.gender && (
              <div>
                <dt className="text-ink-faint">{t("registration.gender")}</dt>
                <dd>
                  {t(
                    `auth.register.gender.${member.gender.toLowerCase()}` as TranslationKey,
                  )}
                </dd>
              </div>
            )}
            {member.email && (
              <div>
                <dt className="text-ink-faint">{t("common.email")}</dt>
                <dd className="break-all">{member.email}</dd>
              </div>
            )}
            {member.phoneNumber && (
              <div>
                <dt className="text-ink-faint">{t("registration.phone")}</dt>
                <dd className="break-all">{member.phoneNumber}</dd>
              </div>
            )}
          </dl>
        )}
    </li>
  );
}

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
  const stats: Array<[TranslationKey, number | null]> = [
    ["teamDetail.played", team.history.completedMatches],
    ["teamDetail.wins", team.history.wins],
    ["teamDetail.draws", team.history.draws],
    ["teamDetail.losses", team.history.losses],
    ["teamDetail.rank", team.history.finalRank],
  ];

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
      <title>{`${t("teamDetail.title")} | ArenaVerse`}</title>
      <Link
        href={`${tournamentHref}#participants`}
        className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-brand focus-visible:outline-2 focus-visible:outline-brand"
      >
        <ArrowLeftIcon aria-hidden size={16} />
        <span className="break-words">{team.tournament.name}</span>
      </Link>

      <header className="mt-5 rounded-2xl border border-line bg-surface-card p-5 sm:p-8">
        <div className="flex flex-wrap items-start gap-5">
          <span className="grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-brand/10 text-3xl font-bold text-brand">
            <ResolvedImage
              src={team.logoUrl}
              alt={team.name}
              className="size-full object-cover"
              fallback={team.name.charAt(0).toUpperCase()}
            />
          </span>
          <div className="min-w-0 flex-1 basis-48">
            <p className="text-xs font-semibold uppercase tracking-widest text-brand">
              {t("teamDetail.title")}
            </p>
            <h1 className="mt-2 break-words text-2xl font-bold text-ink sm:text-3xl">
              {team.name}
            </h1>
            {team.shortName && (
              <p className="mt-1 break-words text-sm text-ink-faint">
                {team.shortName}
              </p>
            )}
            <p className="mt-3 break-words text-sm text-ink-muted">
              {t("teamDetail.captain")}: {team.captain.displayName}
            </p>
          </div>
          <StatusBadge status={team.status} />
        </div>
        {team.description && (
          <p className="mt-5 whitespace-pre-wrap break-words border-t border-line pt-5 text-sm leading-7 text-ink-muted">
            {team.description}
          </p>
        )}
      </header>

      {user && canManageIdentity && !user.emailVerifiedAt && (
        <EmailVerificationNotice email={user.email} className="mt-8" />
      )}
      {user?.emailVerifiedAt && canManageIdentity && (
        <TeamManagementPanel team={team} user={user} onChanged={onChanged} />
      )}

      <section aria-labelledby="team-stats" className="mt-8">
        <h2 id="team-stats" className="text-xl font-bold">
          {t("teamDetail.stats")}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {t("teamDetail.statsHint")}
        </p>
        <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {stats.map(([label, value]) => (
            <div
              key={label}
              className="rounded-xl border border-line bg-surface-card p-4"
            >
              <dt className="text-xs text-ink-muted">{t(label)}</dt>
              <dd className="mt-2 text-2xl font-bold text-brand">
                {value === null ? "—" : formatLocalizedNumber(value, locale)}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {team.canViewSensitiveInfo && (
        <section
          aria-labelledby="team-contact"
          className="mt-8 rounded-2xl border border-line bg-surface-card p-5 sm:p-6"
        >
          <h2 id="team-contact" className="text-xl font-bold">
            {t("registration.representative")}
          </h2>
          <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-ink-faint">{t("registration.fullName")}</dt>
              <dd className="mt-1 break-words">{team.contactName}</dd>
            </div>
            {team.contactEmail && (
              <div>
                <dt className="text-ink-faint">{t("common.email")}</dt>
                <dd className="mt-1 break-all">{team.contactEmail}</dd>
              </div>
            )}
            {team.contactPhone && (
              <div>
                <dt className="text-ink-faint">{t("registration.phone")}</dt>
                <dd className="mt-1 break-all">{team.contactPhone}</dd>
              </div>
            )}
          </dl>
        </section>
      )}

      <section
        aria-labelledby="team-roster"
        className="mt-8 rounded-2xl border border-line bg-surface-card p-5 sm:p-6"
      >
        <h2
          id="team-roster"
          className="flex items-center gap-2 text-xl font-bold"
        >
          <UsersThreeIcon aria-hidden size={22} />
          {t("teamDetail.roster")}{" "}
          <span className="text-sm font-normal text-ink-faint">
            ({team.members.length})
          </span>
        </h2>
        {team.members.length ? (
          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {team.members.map((member) => (
              <MemberCard
                key={member.id}
                member={member}
                sensitive={team.canViewSensitiveInfo}
              />
            ))}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-ink-muted">
            {t("teamDetail.noMembers")}
          </p>
        )}
      </section>

      <section
        aria-labelledby="team-history"
        className="mt-8 rounded-2xl border border-line bg-surface-card p-5 sm:p-6"
      >
        <h2 id="team-history" className="text-xl font-bold">
          {t("teamDetail.history")}
        </h2>
        <p className="mt-1 text-sm text-ink-muted">
          {t("teamDetail.historyHint")}
        </p>
        {team.history.recentMatches.length ? (
          <ul className="mt-5 space-y-3">
            {team.history.recentMatches.map((match) => {
              const date = match.playedAt ?? match.scheduledAt;
              return (
                <li
                  key={match.id}
                  className="rounded-xl border border-line bg-surface-sub/45 p-4"
                >
                  <div className="flex flex-wrap justify-between gap-2 text-xs text-ink-muted">
                    <span className="break-words">{match.round.name}</span>
                    {date && (
                      <time dateTime={date}>
                        {formatLocalizedDate(date, locale, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </time>
                    )}
                  </div>
                  <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 text-sm">
                    <span
                      className={`break-words ${match.winnerTeamId && match.winnerTeamId === match.teamA?.id ? "font-bold text-brand" : "text-ink"}`}
                    >
                      {match.teamA?.name ?? t("teamDetail.unknownTeam")}
                    </span>
                    <span className="whitespace-nowrap rounded-lg bg-surface-card px-3 py-2 font-mono font-bold">
                      {match.scoreA} – {match.scoreB}
                    </span>
                    <span
                      className={`break-words text-right ${match.winnerTeamId && match.winnerTeamId === match.teamB?.id ? "font-bold text-brand" : "text-ink"}`}
                    >
                      {match.teamB?.name ?? t("teamDetail.unknownTeam")}
                    </span>
                  </div>
                  {match.outcome === "DRAW" && (
                    <p className="mt-2 text-center text-xs text-ink-muted">
                      {t("teamDetail.draw")}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-5 text-sm text-ink-muted">
            {t("teamDetail.noMatches")}
          </p>
        )}
        <Link
          href={`${tournamentHref}#competition`}
          className="mt-5 inline-block text-sm font-semibold text-brand hover:underline"
        >
          {t("teamDetail.competition")}
        </Link>
      </section>
    </div>
  );
}
