"use client";

import Link from "next/link";
import { ArrowUpRightIcon, SwordIcon } from "@phosphor-icons/react";
import { formatLocalizedDate } from "@/features/locale/format";
import { useLocale } from "@/features/locale/store";
import type { TeamDetail } from "@/features/teams/types";
import styles from "./TeamProfile.module.css";

export default function TeamMatchHistory({ team }: { team: TeamDetail }) {
  const { locale, t } = useLocale();
  return (
    <section
      id="team-history"
      aria-labelledby="team-history-title"
      className={`${styles.panel} p-5 sm:p-6`}
    >
      <div className="flex items-center gap-3">
        <span className="grid size-10 place-items-center rounded-lg border border-line bg-surface-sub text-accent">
          <SwordIcon size={21} aria-hidden />
        </span>
        <div>
          <p className={styles.eyebrow}>{t("teamDetail.stats")}</p>
          <h2
            id="team-history-title"
            className="mt-1 text-xl font-bold text-ink"
          >
            {t("teamDetail.history")}
          </h2>
        </div>
      </div>
      <p className="mt-3 text-xs leading-5 text-ink-muted">
        {t("teamDetail.historyHint")}
      </p>
      {team.history.recentMatches.length ? (
        <ul className="mt-5 divide-y divide-line border-y border-line">
          {team.history.recentMatches.map((match) => {
            const date = match.playedAt ?? match.scheduledAt;
            const won = match.winnerTeamId === team.id;
            const lost = Boolean(match.winnerTeamId && !won);
            const result = won
              ? "teamDetail.resultWin"
              : lost
                ? "teamDetail.resultLoss"
                : match.outcome === "DRAW"
                  ? "teamDetail.draw"
                  : null;
            return (
              <li key={match.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-ink-muted">
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
                    className={`break-words ${match.teamA?.id === team.id ? "font-bold text-ink" : "text-ink-muted"}`}
                  >
                    {match.teamA?.name ?? t("teamDetail.unknownTeam")}
                  </span>
                  <span className="border border-line bg-surface-sub px-3 py-2 font-mono text-lg font-bold tabular-nums text-ink">
                    <span
                      className={
                        match.winnerTeamId &&
                        match.winnerTeamId === match.teamA?.id
                          ? "text-accent"
                          : ""
                      }
                    >
                      {match.scoreA}
                    </span>
                    <span className="px-2 text-ink-faint">:</span>
                    <span
                      className={
                        match.winnerTeamId &&
                        match.winnerTeamId === match.teamB?.id
                          ? "text-accent"
                          : ""
                      }
                    >
                      {match.scoreB}
                    </span>
                  </span>
                  <span
                    className={`break-words text-right ${match.teamB?.id === team.id ? "font-bold text-ink" : "text-ink-muted"}`}
                  >
                    {match.teamB?.name ?? t("teamDetail.unknownTeam")}
                  </span>
                </div>
                {result && (
                  <p
                    className={`mt-2 text-center text-[10px] font-bold uppercase tracking-widest ${won ? "text-approved" : lost ? "text-rejected" : "text-ink-muted"}`}
                  >
                    {t(result)}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="mt-5 border border-dashed border-line bg-surface-sub/40 px-5 py-10 text-center">
          <SwordIcon
            size={30}
            aria-hidden
            className="mx-auto text-ink-faint"
          />
          <p className="mt-3 text-sm text-ink-muted">
            {t("teamDetail.noMatches")}
          </p>
        </div>
      )}
      <Link
        href={`/tournaments/${encodeURIComponent(team.tournament.slug)}#competition`}
        className="mt-5 flex w-fit items-center gap-2 text-xs font-semibold text-accent hover:underline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        {t("teamDetail.viewCompetition")}
        <ArrowUpRightIcon size={16} aria-hidden />
      </Link>
    </section>
  );
}
