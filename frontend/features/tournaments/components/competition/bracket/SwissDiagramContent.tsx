"use client";

import { useState } from "react";
import { useLocale } from "@/features/locale/store";
import { formatLocalizedDate } from "@/features/locale/format";
import type { BracketMatch, RoundBracket } from "@/features/tournaments/types";
import type { SwissBracketLayout } from "./swiss-presentation";
import DiagramMatchCard from "./DiagramMatchCard";
import styles from "./bracket.module.css";

export default function SwissDiagramContent({
  layout,
  bracket,
  numbers,
  onSelectMatch,
}: {
  layout: SwissBracketLayout;
  bracket: RoundBracket;
  numbers: ReadonlyMap<string, number>;
  onSelectMatch?: (match: BracketMatch) => void;
}) {
  const { t, locale } = useLocale();
  const [hovered, setHovered] = useState<string | null>(null);
  const matches = new Map(bracket.matches.map((match) => [match.id, match]));
  const { cardWidth, cardHeight, padding } = layout.metrics;
  return (
    <>
      {layout.columns.map((column) => (
        <div
          className={styles.columnHeading}
          key={column.key}
          style={{ left: column.x, top: column.y, width: cardWidth }}
        >
          <span>
            {t("competition.swissIteration")} {column.round}
          </span>
          {column.pending && (
            <div
              className={styles.swissPending}
              style={{ top: layout.height / 2 - padding - 50 }}
            >
              <strong>— / —</strong>
              <p>{t("bracket.awaitingPairing")}</p>
              <small>{t("bracket.swissPendingHint")}</small>
            </div>
          )}
        </div>
      ))}
      <svg
        className={styles.connections}
        width={layout.width}
        height={layout.height}
        aria-hidden="true"
      >
        {layout.edges.map((edge) => (
          <path
            key={`${edge.from}-${edge.to}-${edge.result}`}
            d={edge.path}
            className={styles.edge}
            data-result={edge.result}
            data-emphasized={hovered === edge.from || hovered === edge.to}
            data-muted={Boolean(
              hovered && hovered !== edge.from && hovered !== edge.to,
            )}
          />
        ))}
      </svg>
      {layout.groups.map(({ group, x, y, height }) => {
        const fixtures = group.entries.map((entry) =>
          matches.get(entry.matchId)!,
        );
        const bestOf = [
          ...new Set(fixtures.map((match) => `BO${match.bestOf}`)),
        ].join(" / ");
        const dates = [
          ...new Set(
            fixtures
              .map((match) => match.scheduledAt)
              .filter((date): date is string => Boolean(date)),
          ),
        ].sort();
        const firstDate = dates[0]
          ? formatLocalizedDate(dates[0], locale, {
              day: "2-digit",
              month: "2-digit",
            })
          : "";
        const lastDate = dates.length
          ? formatLocalizedDate(dates[dates.length - 1], locale, {
              day: "2-digit",
              month: "2-digit",
            })
          : "";
        const recordLabel =
          group.records
            .map((record) => `${record.wins}–${record.losses}`)
            .join(" / ") || t("match.awaitingTeam");
        return (
          <section
            key={group.id}
            className={styles.swissGroup}
            data-swiss-group={group.id}
            aria-label={`${t("competition.swissIteration")} ${group.bracketRound} · ${recordLabel}`}
            style={{ left: x, top: y, width: cardWidth, height }}
            onMouseEnter={() => setHovered(group.id)}
            onMouseLeave={() => setHovered(null)}
            onFocus={() => setHovered(group.id)}
            onBlur={() => setHovered(null)}
          >
            <h5
              className={styles.swissRecord}
              title={
                group.records.length > 1 ? t("bracket.swissMixed") : undefined
              }
            >
              {recordLabel}
            </h5>
            <div className={styles.swissFixtures}>
              {group.entries.map((entry) => (
                <div key={entry.matchId} style={{ height: cardHeight }}>
                  <DiagramMatchCard
                    match={matches.get(entry.matchId)!}
                    bracket={bracket}
                    numbers={numbers}
                    records={group.records.length > 1 ? entry : undefined}
                    onSelect={onSelectMatch}
                  />
                </div>
              ))}
            </div>
            <footer className={styles.swissGroupFooter}>
              <span>
                {bracket.round.settings.scoringMode === "POINT_SCORE"
                  ? t("round.settings.scoringMode.POINT_SCORE")
                  : bestOf}
              </span>
              <span>
                {firstDate}
                {lastDate !== firstDate && ` – ${lastDate}`}
              </span>
            </footer>
          </section>
        );
      })}
      {layout.results.length > 0 && (
        <div
          className={styles.columnHeading}
          style={{ left: layout.results[0].x, top: padding, width: cardWidth }}
        >
          <span>{t("bracket.currentStandings")}</span>
        </div>
      )}
      {layout.results.map((group) => (
        <section
          className={styles.swissResult}
          key={group.key}
          style={{
            left: group.x,
            top: group.y,
            width: cardWidth,
            height: group.height,
          }}
          data-qualified={group.qualified}
          data-eliminated={group.eliminated}
          aria-label={`${group.wins}–${group.losses} ${group.qualified ? t("bracket.swissQualified") : group.eliminated ? t("swiss.eliminated") : t("bracket.currentStandings")}`}
        >
          <h5 className={styles.swissRecord}>
            {group.wins}–{group.losses}
            {group.qualified && <span>{t("bracket.swissQualified")}</span>}
            {group.eliminated && <span>{t("swiss.eliminated")}</span>}
          </h5>
          <div className={styles.swissResultTeams}>
            {group.teams.map((row) => (
              <span
                key={row.teamId}
                title={`#${row.rank} · ${row.team?.name ?? t("match.noTeam")}`}
              >
                {row.team?.name || t("match.noTeam")}
              </span>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}
