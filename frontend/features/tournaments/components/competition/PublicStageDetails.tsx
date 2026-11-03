import type { RoundStandings, TournamentRound } from "@/features/tournaments/types";
import { useLocale } from "@/features/locale/store";
import RoundSettingsSummary from "./RoundSettingsSummary";
import styles from "./PublicStageDetails.module.css";

export default function PublicStageDetails({
  round,
  standings,
}: {
  round: TournamentRound;
  standings?: RoundStandings;
}) {
  const { t } = useLocale();
  const qualifiedTeamIds = new Set(
    standings?.advancement.qualifiedTeams.map(({ team }) => team.id) ?? [],
  );
  const participants = [...(standings?.participants ?? [])].sort(
    (left, right) =>
      (left.seed ?? left.team.seed ?? Number.MAX_SAFE_INTEGER) -
      (right.seed ?? right.team.seed ?? Number.MAX_SAFE_INTEGER),
  );
  const firstSource = participants[0]?.advancedFromRound;
  const sharedSource =
    firstSource &&
    participants.every(
      (participant) => participant.advancedFromRound?.id === firstSource.id,
    )
      ? firstSource.name
      : null;

  return (
    <div className={styles.details}>
      <details className={styles.group}>
        <summary className={styles.summary}>
          {t("competition.formatDetails")}
        </summary>
        <div className={styles.content}>
          <RoundSettingsSummary round={round} className={styles.settings} />
        </div>
      </details>
      {participants.length > 0 && (
        <details className={styles.group}>
          <summary className={styles.summary}>
            {t("competition.stageParticipants")} ({participants.length})
          </summary>
          {sharedSource && (
            <p className={styles.sourceNote}>
              {t("competition.advancedFrom")} {sharedSource}
            </p>
          )}
          <ul className={styles.participants}>
            {participants.map((participant) => {
              const seed = participant.seed ?? participant.team.seed;
              return (
                <li key={participant.team.id} className={styles.participant}>
                  {seed != null && (
                    <span className={styles.seed}>#{seed}</span>
                  )}
                  <span className={styles.teamInfo}>
                    <strong>{participant.team.name}</strong>
                    {!sharedSource && participant.advancedFromRound && (
                      <small>
                        {t("progress.qualifiedFrom")} {participant.advancedFromRound.name}
                      </small>
                    )}
                  </span>
                  {qualifiedTeamIds.has(participant.team.id) && (
                    <span className={styles.qualified}>
                      {t("competition.qualified")}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </details>
      )}
    </div>
  );
}
