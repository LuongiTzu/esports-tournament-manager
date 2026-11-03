"use client";

import { ArrowUpRightIcon, YoutubeLogoIcon } from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { formatLocalizedDate } from "@/features/locale/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import type { BracketMatch } from "@/features/tournaments/types";
import { matchScore, type Slot } from "./bracket/bracket-presentation";
import styles from "./league.module.css";

export default function LeagueMatchCard({
  match,
  onSelect,
}: {
  match: BracketMatch;
  onSelect?: (match: BracketMatch) => void;
}) {
  const { locale, t } = useLocale();
  const matchLabel = `${t("match.label")} ${match.matchNumber ?? "–"}`;
  const teamName = (slot: Slot) =>
    match.slots[slot]?.name ??
    (match.isBye ? t("bracket.bye") : t("match.awaitingTeam"));
  const renderTeam = (slot: Slot) => {
    const team = match.slots[slot];
    return (
      <span
        className={styles.fixtureTeam}
        data-slot={slot}
        data-winner={Boolean(team && match.winner?.id === team.id)}
        data-loser={Boolean(team && match.winner && match.winner.id !== team.id)}
      >
        <span className={styles.fixtureLogo}>
          {team && (
            <ResolvedImage
              src={team.logoUrl}
              alt=""
              className="size-full object-contain"
              fallback={team.name.charAt(0)}
            />
          )}
        </span>
        {team?.seed != null && <small className={styles.fixtureSeed}>({team.seed})</small>}
        <span className={styles.fixtureName} title={teamName(slot)}>
          {teamName(slot)}
        </span>
        <strong className={styles.fixtureScore}>{matchScore(match, slot)}</strong>
      </span>
    );
  };
  const content = (
    <>
      <span className={styles.fixtureHeader}>
        <span>{matchLabel}</span>
        {match.youtubeUrl && (
          <span className={styles.fixtureVideo} title={t("youtube.available")}>
            <YoutubeLogoIcon aria-hidden="true" size={13} />
            VIDEO
          </span>
        )}
      </span>
      {renderTeam("A")}
      {renderTeam("B")}
      <span className={styles.fixtureFooter}>
        <span>
          {match.scheduledAt
            ? formatLocalizedDate(match.scheduledAt, locale, {
                dateStyle: "short",
                timeStyle: "short",
              })
            : t("bracket.schedulePending")}
        </span>
        <span>BO{match.bestOf}</span>
        <span className={styles.fixtureStatus} data-status={match.status}>
          {t(`match.status.${match.status}` as TranslationKey)}
        </span>
        {onSelect && <ArrowUpRightIcon aria-hidden="true" size={15} />}
      </span>
    </>
  );
  const label = `${t("match.viewDetails")}: ${matchLabel}, ${teamName("A")} ${matchScore(match, "A")} – ${teamName("B")} ${matchScore(match, "B")}${match.youtubeUrl ? `, ${t("youtube.available")}` : ""}`;

  return onSelect ? (
    <button
      type="button"
      className={styles.fixture}
      data-inactive={!match.isActive}
      onClick={() => onSelect(match)}
      aria-label={label}
    >
      {content}
    </button>
  ) : (
    <article className={styles.fixture} data-inactive={!match.isActive} aria-label={label}>
      {content}
    </article>
  );
}
