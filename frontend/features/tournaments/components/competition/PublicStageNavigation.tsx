"use client";

import { useId } from "react";
import { useLocale } from "@/features/locale/store";
import type { TournamentRound } from "@/features/tournaments/types";
import styles from "./PublicStageNavigation.module.css";

export default function PublicStageNavigation({
  rounds,
  selectedRoundId,
  onSelect,
}: {
  rounds: TournamentRound[];
  selectedRoundId?: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useLocale();
  const labelId = useId();
  const onlyRound = rounds.length === 1 ? rounds[0] : undefined;

  if (onlyRound)
    return (
      <div className={styles.navigation}>
        <p className={styles.label}>{t("competition.stage")}</p>
        <p className={styles.single}>{onlyRound.name}</p>
      </div>
    );

  return (
    <nav className={styles.navigation} aria-labelledby={labelId}>
      <p id={labelId} className={styles.label}>
        {t("competition.chooseStage")}
      </p>
      <div className={styles.tabs}>
        {rounds.map((round, index) => (
          <button
            key={round.id}
            type="button"
            onClick={() => onSelect(round.id)}
            aria-current={round.id === selectedRoundId ? "true" : undefined}
            className={styles.tab}
          >
            <span className={styles.number}>
              {String(index + 1).padStart(2, "0")}
            </span>
            <span className={styles.tabText}>
              <span className={styles.name} title={round.name}>
                {round.name}
              </span>
              <span className={styles.status} data-status={round.status}>
                {t(`round.status.${round.status}`)}
              </span>
            </span>
          </button>
        ))}
      </div>
      <select
        className={styles.select}
        value={selectedRoundId}
        onChange={(event) => onSelect(event.target.value)}
        aria-labelledby={labelId}
      >
        {rounds.map((round, index) => (
          <option key={round.id} value={round.id}>
            {String(index + 1).padStart(2, "0")} · {round.name}
          </option>
        ))}
      </select>
    </nav>
  );
}
