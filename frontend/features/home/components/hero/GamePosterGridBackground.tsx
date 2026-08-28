"use client";

import { useEffect } from "react";
import Image from "next/image";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  type MotionValue,
} from "motion/react";
import styles from "./GamePosterGridBackground.module.css";

const POSTER_ROOT = "/images/tournaments/common/posters";
const GAME_POSTERS = [
  `${POSTER_ROOT}/league-of-legends.jpg`,
  `${POSTER_ROOT}/valorant.jpg`,
  `${POSTER_ROOT}/dota-2.jpg`,
  `${POSTER_ROOT}/counter-strike-2.jpg`,
  `${POSTER_ROOT}/arena-of-valor.jpg`,
  `${POSTER_ROOT}/wild-rift.jpg`,
  `${POSTER_ROOT}/mobile legend.jpg`,
  `${POSTER_ROOT}/honor-of-king.jpg`,
  `${POSTER_ROOT}/rocket-league.jpg`,
  `${POSTER_ROOT}/fc-online.jpg`,
  `${POSTER_ROOT}/street-fighter.jpg`,
  `${POSTER_ROOT}/tenken.jpg`,
  `${POSTER_ROOT}/pokemon-unite.jpg`,
  `${POSTER_ROOT}/crossfire.jpg`,
] as const;

const DEFAULT_ROW_COUNT = 4;
const DENSE_ROW_COUNT = 8;
const ITEMS_PER_ROW = 7;
const MAX_ROW_MOVEMENT = [92, 72, 82, 64] as const;

function postersForRow(rowIndex: number) {
  return Array.from({ length: ITEMS_PER_ROW }, (_, itemIndex) => {
    const posterIndex = (rowIndex * 5 + itemIndex * 3) % GAME_POSTERS.length;
    return GAME_POSTERS[posterIndex];
  });
}

function PosterRow({
  rowIndex,
  pointerPosition,
}: {
  rowIndex: number;
  pointerPosition: MotionValue<number>;
}) {
  const direction = rowIndex % 2 === 0 ? 1 : -1;
  const movement =
    MAX_ROW_MOVEMENT[rowIndex % MAX_ROW_MOVEMENT.length] * direction;
  const x = useTransform(pointerPosition, [-1, 1], [-movement, movement]);

  return (
    <motion.div className={styles.row} style={{ x }}>
      {postersForRow(rowIndex).map((poster, itemIndex) => (
        <div className={styles.poster} key={`${rowIndex}-${itemIndex}-${poster}`}>
          <Image
            src={poster}
            alt=""
            fill
            sizes="(max-width: 639px) 45vw, (max-width: 1023px) 28vw, 20vw"
            quality={50}
            className={styles.image}
          />
        </div>
      ))}
    </motion.div>
  );
}

export default function GamePosterGridBackground({
  dense = false,
}: {
  dense?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const pointerPosition = useMotionValue(0);
  const smoothPointerPosition = useSpring(pointerPosition, {
    stiffness: 90,
    damping: 24,
    mass: 0.7,
  });

  useEffect(() => {
    const coarsePointer = window.matchMedia("(pointer: coarse)");
    if (prefersReducedMotion || coarsePointer.matches) {
      pointerPosition.set(0);
      return;
    }

    const updatePointerPosition = (event: PointerEvent) => {
      const normalizedPosition = (event.clientX / window.innerWidth) * 2 - 1;
      pointerPosition.set(Math.max(-1, Math.min(1, normalizedPosition)));
    };

    window.addEventListener("pointermove", updatePointerPosition, {
      passive: true,
    });
    return () => window.removeEventListener("pointermove", updatePointerPosition);
  }, [pointerPosition, prefersReducedMotion]);

  return (
    <div
      aria-hidden="true"
      className={`${styles.root} ${dense ? styles.dense : ""}`}
    >
      <div className={styles.grid}>
        {Array.from(
          { length: dense ? DENSE_ROW_COUNT : DEFAULT_ROW_COUNT },
          (_, rowIndex) => (
          <PosterRow
            key={rowIndex}
            rowIndex={rowIndex}
            pointerPosition={smoothPointerPosition}
          />
          ),
        )}
      </div>
      <div className={styles.veil} />
    </div>
  );
}
