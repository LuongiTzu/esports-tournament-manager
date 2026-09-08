"use client";

import ResolvedImage from "@/components/ResolvedImage";
import { useLocale } from "@/features/locale/store";
import { formatLocalizedDate } from "@/features/locale/format";
import type {
  BracketMatch,
  RoundBracket,
  SwissRecord,
} from "@/features/tournaments/types";
import {
  matchCode,
  matchHeading,
  matchScore,
  sourceLabel,
  type MatchSources,
  type Slot,
} from "./bracket-presentation";
import styles from "./bracket.module.css";

export default function DiagramMatchCard({
  match,
  bracket,
  sources,
  numbers,
  records,
  onSelect,
}: {
  match: BracketMatch;
  bracket: RoundBracket;
  sources?: MatchSources;
  numbers?: ReadonlyMap<string, number>;
  records?: { A: SwissRecord | null; B: SwissRecord | null };
  onSelect?: (match: BracketMatch) => void;
}) {
  const { t, locale } = useLocale();
  const stacked = bracket.round.format === "DOUBLE_ELIM";
  const fullHeading = matchHeading(match, bracket, t);
  const heading =
    fullHeading === matchCode(match) && numbers?.has(match.id)
      ? `${t("match.label")} ${numbers.get(match.id)}`
      : fullHeading;
  const pendingReset = Boolean(match.activationCondition && !match.isActive);
  const schedule = match.scheduledAt
    ? formatLocalizedDate(match.scheduledAt, locale, {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })
    : "";
  const scoreMode =
    bracket.round.settings.scoringMode === "POINT_SCORE"
      ? t("round.settings.scoringMode.POINT_SCORE")
      : `BO${match.bestOf}`;
  const hasScore = match.status !== "PENDING" && match.isActive && !match.isBye;
  const slotName = (slot: Slot) =>
    match.slots[slot]?.name ??
    (match.isBye && !sources?.[slot]
      ? t("bracket.bye")
      : sourceLabel(sources?.[slot], t, numbers));
  const renderTeam = (slot: Slot) => {
    const team = match.slots[slot];
    const winner = Boolean(team && match.winner?.id === team.id);
    const loser = Boolean(team && match.winner && !winner);
    return (
      <span
        className={styles.team}
        data-slot={slot}
        data-empty={!team}
        data-winner={winner}
        data-loser={loser}
      >
        <span className={styles.logo}>
          {team && (
            <ResolvedImage
              src={team.logoUrl}
              alt=""
              className="size-full object-contain"
              fallback={team.name.charAt(0)}
            />
          )}
        </span>
        {stacked && team?.seed != null && (
          <span className={styles.seed}>({team.seed})</span>
        )}
        <span className={styles.teamName} title={slotName(slot)}>
          {team?.shortName || slotName(slot)}
        </span>
        {records?.[slot] && (
          <small className={styles.teamRecord}>
            {records[slot].wins}–{records[slot].losses}
          </small>
        )}
        {stacked && hasScore && (
          <span className={styles.score}>{matchScore(match, slot)}</span>
        )}
      </span>
    );
  };
  const content = (
    <>
      {stacked && (
        <span
          className={styles.matchHeader}
          title={`${matchCode(match)} · ${schedule}`}
        >
          <span>
            {heading}
            {schedule && ` · ${schedule}`}
          </span>
          {pendingReset ? (
            <span>{t("bracket.ifNeeded")}</span>
          ) : match.isBye ? (
            <span>BYE</span>
          ) : match.status === "ONGOING" ? (
            <span data-status="ONGOING">{t("match.status.ONGOING")}</span>
          ) : null}
        </span>
      )}
      <span className={styles.matchTeams}>
        {renderTeam("A")}
        {!stacked && (
          <span className={styles.versus}>
            {hasScore ? (
              <>
                <b data-winner={match.winner?.id === match.slots.A?.id}>
                  {matchScore(match, "A")}
                </b>
                <i>–</i>
                <b data-winner={match.winner?.id === match.slots.B?.id}>
                  {matchScore(match, "B")}
                </b>
              </>
            ) : match.isBye ? (
              "BYE"
            ) : (
              "VS"
            )}
          </span>
        )}
        {renderTeam("B")}
      </span>
      <span className={styles.matchFooter}>
        <span>{pendingReset ? t("bracket.resetCondition") : scoreMode}</span>
        {numbers?.has(match.id) && <span>M{numbers.get(match.id)}</span>}
        <span>{stacked ? "" : schedule}</span>
      </span>
    </>
  );
  const label = `${t("match.viewDetails")}: ${heading}, ${slotName("A")} ${matchScore(match, "A")} — ${slotName("B")} ${matchScore(match, "B")}, ${pendingReset ? t("bracket.ifNeeded") : t(`match.status.${match.status}`)}`;
  const title = `${heading} · ${matchCode(match)} · ${schedule || t("bracket.schedulePending")}`;
  return onSelect ? (
    <button
      type="button"
      className={styles.match}
      data-inactive={!match.isActive}
      onClick={() => onSelect(match)}
      aria-label={label}
      title={title}
    >
      {content}
    </button>
  ) : (
    <article
      className={styles.match}
      data-inactive={!match.isActive}
      aria-label={label}
      title={title}
    >
      {content}
    </article>
  );
}
