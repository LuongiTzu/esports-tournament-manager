"use client";

import { useState } from "react";
import ResolvedImage from "@/components/ResolvedImage";
import { useLocale } from "@/features/locale/store";
import { roundFormatLabel } from "@/features/tournaments/round-formats";
import type {
  BracketMatch,
  BracketTeam,
  RoundBracket,
  RoundStandings,
} from "@/features/tournaments/types";
import StandingsTable from "../manage/StandingsTable";
import BracketMatchCard from "../manage/BracketMatchCard";
import BracketBackdrop from "./bracket/BracketBackdrop";
import styles from "./league.module.css";

export default function LeagueCompetitionView({
  bracket,
  standings,
  bannerUrl,
  tournamentName,
  onSelectMatch,
}: {
  bracket: RoundBracket;
  standings?: RoundStandings;
  bannerUrl?: string | null;
  tournamentName?: string;
  onSelectMatch?: (match: BracketMatch) => void;
}) {
  const { t } = useLocale();
  const [view, setView] = useState<"standings" | "schedule">("standings");
  const [groupId, setGroupId] = useState("");
  const [iteration, setIteration] = useState("");
  const grouped = bracket.round.format === "GROUP_STAGE";
  const teams = new Map<string, BracketTeam>();
  for (const group of bracket.groups)
    for (const team of group.teams) teams.set(team.id, team);
  for (const match of bracket.matches)
    for (const team of [match.slots.A, match.slots.B])
      if (team) teams.set(team.id, team);
  for (const assignment of standings?.participants ?? [])
    teams.set(assignment.team.id, assignment.team);
  const qualified =
    standings?.advancement.qualifiedTeams.map(({ team }) => team.id) ?? [];
  const groupRows =
    standings?.format === "GROUP_STAGE" ? standings.standings : [];
  const selectedGroups = bracket.groups.filter(
    (group) => !groupId || group.id === groupId,
  );
  const groupMatches = bracket.matches.filter(
    (match) => !groupId || match.groupId === groupId,
  );
  const iterations = [
    ...new Set(groupMatches.map((match) => match.bracketRound ?? 0)),
  ].sort((a, b) => a - b);
  const visibleIterations = iterations.filter(
    (round) => !iteration || String(round) === iteration,
  );
  const cutoff =
    bracket.round.format === "GROUP_STAGE"
      ? bracket.round.settings.advancingTeamsPerGroup
      : bracket.round.format === "ROUND_ROBIN"
        ? bracket.round.settings.advancingTeamCount
        : undefined;
  return (
    <section
      className={styles.board}
      aria-label={roundFormatLabel(bracket.round.format, t)}
    >
      <BracketBackdrop roundId={bracket.round.id} bannerUrl={bannerUrl} />
      <div className={styles.content}>
        <header className={styles.header}>
          <div>
            <p className={styles.eyebrow}>
              {tournamentName ?? bracket.round.name}
            </p>
            <h3>{roundFormatLabel(bracket.round.format, t)}</h3>
            <p className="mt-1 text-sm text-ink-muted">{bracket.round.name}</p>
          </div>
          <div
            className={styles.tabs}
            role="group"
            aria-label={t("bracket.viewMode")}
          >
            {(["standings", "schedule"] as const).map((tab) => (
              <button
                type="button"
                key={tab}
                aria-pressed={view === tab}
                onClick={() => setView(tab)}
              >
                {t(
                  tab === "standings"
                    ? "competition.standings"
                    : "competition.table.schedule",
                )}
              </button>
            ))}
          </div>
        </header>
        {grouped && bracket.groups.length > 0 && (
          <nav
            className={styles.filters}
            aria-label={t("competition.table.overview")}
          >
            <button
              type="button"
              aria-pressed={!groupId}
              onClick={() => {
                setGroupId("");
                setIteration("");
              }}
            >
              {t("competition.table.all")}
            </button>
            {bracket.groups.map((group) => (
              <button
                type="button"
                key={group.id}
                aria-pressed={groupId === group.id}
                onClick={() => {
                  setGroupId(group.id);
                  setIteration("");
                }}
              >
                {group.name}
              </button>
            ))}
          </nav>
        )}
        {view === "standings" ? (
          <>
            <p className="mb-5 text-xs leading-relaxed text-ink-muted">
              {t("competition.table.cutoff")}
              {grouped && !groupId && ` ${t("competition.table.details")}`}
            </p>
            {grouped ? (
              <div className={styles.groups} data-detail={Boolean(groupId)}>
                {selectedGroups.map((group) => {
                  const rows = groupRows.find(
                    (item) => item.groupId === group.id,
                  )?.standings;
                  return (
                    <section className={styles.group} key={group.id}>
                      <header>
                        <span className={styles.groupIndex}>
                          {String(
                            bracket.groups.findIndex(
                              (item) => item.id === group.id,
                            ) + 1,
                          ).padStart(2, "0")}
                        </span>
                        <button
                          type="button"
                          onClick={() => setGroupId(group.id)}
                        >
                          {group.name}
                        </button>
                        <span className="ml-auto text-xs text-ink-muted">
                          {group.teams.length}{" "}
                          {t("competition.groupSummaryTeams")}
                        </span>
                      </header>
                      {rows?.length ? (
                        <StandingsTable
                          rows={rows}
                          qualifiedTeamIds={qualified}
                          teams={teams}
                          compact={!groupId}
                          cutoff={cutoff}
                        />
                      ) : (
                        <div className={styles.roster}>
                          {group.teams.map((team) => (
                            <div key={team.id}>
                              <ResolvedImage
                                src={team.logoUrl}
                                alt=""
                                className="size-7 object-contain"
                                fallback={
                                  <span className="text-brand">
                                    {team.name.slice(0, 1)}
                                  </span>
                                }
                              />
                              <span>{team.name}</span>
                            </div>
                          ))}
                          <p>{t("competition.noStandings")}</p>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            ) : standings?.format === "ROUND_ROBIN" &&
              standings.standings.length ? (
              <div className={styles.group}>
                <StandingsTable
                  rows={standings.standings}
                  qualifiedTeamIds={qualified}
                  teams={teams}
                  cutoff={cutoff}
                />
              </div>
            ) : (
              <div className={styles.roster}>
                {[...teams.values()].map((team) => (
                  <div key={team.id}>
                    <ResolvedImage
                      src={team.logoUrl}
                      alt=""
                      className="size-7 object-contain"
                    />
                    <span>{team.name}</span>
                  </div>
                ))}
                <p>{t("competition.noStandings")}</p>
              </div>
            )}
            {grouped && !selectedGroups.length && (
              <p className={styles.empty}>{t("competition.noGroups")}</p>
            )}
          </>
        ) : (
          <>
            {iterations.length > 0 && (
              <label className="mb-5 flex items-center gap-3 text-sm text-ink-muted">
                {t("competition.iteration")}
                <select
                  value={iteration}
                  onChange={(event) => setIteration(event.target.value)}
                  className={styles.select}
                >
                  <option value="">{t("competition.table.round")}</option>
                  {iterations.map((round) => (
                    <option key={round} value={round}>
                      {t("competition.iteration")} {round}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="space-y-6">
              {visibleIterations.map((round) => (
                <section key={round}>
                  <h4 className="mb-3 text-sm font-semibold text-brand">
                    {t("competition.iteration")} {round}
                  </h4>
                  <div className={styles.matches}>
                    {groupMatches
                      .filter((match) => (match.bracketRound ?? 0) === round)
                      .map((match) => (
                        <div key={match.id}>
                          {grouped && (
                            <p className="mb-2 text-xs text-ink-muted">
                              {
                                bracket.groups.find(
                                  (group) => group.id === match.groupId,
                                )?.name
                              }
                            </p>
                          )}
                          <BracketMatchCard
                            match={match}
                            onSelect={onSelectMatch}
                          />
                        </div>
                      ))}
                  </div>
                </section>
              ))}
            </div>
            {!groupMatches.length && (
              <p className={styles.empty}>{t("competition.noMatches")}</p>
            )}
          </>
        )}
      </div>
    </section>
  );
}
