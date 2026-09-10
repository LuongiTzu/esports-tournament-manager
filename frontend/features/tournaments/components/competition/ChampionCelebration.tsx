"use client";

import { useState, type CSSProperties } from "react";
import { CrownIcon, PauseIcon, PlayIcon, StarFourIcon } from "@phosphor-icons/react/dist/ssr";
import ResolvedImage from "@/components/ResolvedImage";
import TextLoop from "@/components/effects/TextLoop";
import { useLocale } from "@/features/locale/store";
import type { BracketTeam } from "@/features/tournaments/types";
import styles from "./ChampionCelebration.module.css";

function Fireworks({ side }: { side: "left" | "right" }) {
  return (
    <div className={`${styles.fireworks} ${styles[side]}`} aria-hidden="true">
      {[0, 1, 2].map((burst) => (
        <div key={burst} className={styles.burst} style={{ "--burst": burst } as CSSProperties}>
          {Array.from({ length: 16 }, (_, spark) => (
            <span
              key={spark}
              className={styles.ray}
              style={{ "--angle": `${spark * 22.5}deg` } as CSSProperties}
            >
              <span className={styles.spark} />
            </span>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function ChampionCelebration({ champion }: { champion: BracketTeam }) {
  const { t } = useLocale();
  const [paused, setPaused] = useState(false);

  return (
    <section className={styles.root} data-paused={paused} aria-label={t("standings.championCongratulations")}>
      <div className={styles.toolbar}>
        <span className={styles.eyebrow}><CrownIcon weight="fill" aria-hidden="true" /> {t("standings.champion")}</span>
        <button
          type="button"
          className={styles.motionButton}
          onClick={() => setPaused((value) => !value)}
          aria-label={t(paused ? "standings.resumeCelebration" : "standings.pauseCelebration")}
          title={t(paused ? "standings.resumeCelebration" : "standings.pauseCelebration")}
        >
          {paused ? <PlayIcon weight="fill" /> : <PauseIcon weight="fill" />}
        </button>
      </div>
      <TextLoop
        text={t("standings.championCongratulations")}
        paused={paused}
        color="#231333"
        ribbonColor="#c4b5fd"
        ribbonEndColor="#f9a8d4"
      />
      <div className={styles.center}>
        <Fireworks side="left" />
        <div className={styles.identity}>
          <div className={styles.emblem}>
            <ResolvedImage
              src={champion.logoUrl}
              alt=""
              className={styles.logo}
              fallback={<CrownIcon className={styles.fallback} weight="duotone" aria-hidden="true" />}
            />
            <span className={styles.medal} aria-hidden="true"><StarFourIcon weight="fill" /></span>
          </div>
          <div className={styles.details}>
            <p className={styles.congratulations}>{t("standings.championCongratulations")}</p>
            <h4 className={styles.name}>{champion.name}</h4>
            {champion.shortName && <p className={styles.shortName}>{champion.shortName}</p>}
          </div>
        </div>
        <Fireworks side="right" />
      </div>
      <TextLoop
        text={t("standings.championCongratulations")}
        direction="reverse"
        paused={paused}
        color="#15273a"
        ribbonColor="#67e8f9"
        ribbonEndColor="#a5b4fc"
      />
    </section>
  );
}
