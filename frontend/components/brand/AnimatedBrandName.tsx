"use client";

import { useEffect, useId, useState } from "react";
import { motion, useReducedMotion } from "motion/react";
import styles from "./AnimatedBrandName.module.css";

const BRAND_NAME = "ArenaVERSE";
const CHARACTERS = Array.from(BRAND_NAME);
const VIEWBOX_WIDTH = 400;
const VIEWBOX_HEIGHT = 72;
const STROKE_DASH_LENGTH = 480;
const DRAW_DURATION = 1.6;
const FILL_DELAY = 0.2;
const STAGGER = 0.05;
const REPLAY_INTERVAL = 8_000;

interface AnimatedBrandNameProps {
  className?: string;
}

export default function AnimatedBrandName({
  className = "",
}: AnimatedBrandNameProps) {
  const prefersReducedMotion = useReducedMotion();
  const [animationCycle, setAnimationCycle] = useState(0);
  const rawId = useId();
  const clipId = `brand-fill-${rawId.replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const fillStart = DRAW_DURATION + FILL_DELAY;

  useEffect(() => {
    if (prefersReducedMotion) return;

    const intervalId = window.setInterval(() => {
      setAnimationCycle((cycle) => cycle + 1);
    }, REPLAY_INTERVAL);

    return () => window.clearInterval(intervalId);
  }, [prefersReducedMotion]);

  return (
    <span
      aria-hidden="true"
      className={`${styles.root} ${className}`.trim()}
    >
      <svg
        key={animationCycle}
        className={styles.svg}
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="xMinYMid meet"
        focusable="false"
      >
        <defs>
          <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
            <motion.rect
              x="0"
              y="0"
              height={VIEWBOX_HEIGHT}
              initial={{ width: prefersReducedMotion ? VIEWBOX_WIDTH : 0 }}
              animate={{ width: VIEWBOX_WIDTH }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : {
                      delay: fillStart,
                      duration: DRAW_DURATION * 0.5,
                      ease: "easeInOut",
                    }
              }
            />
          </clipPath>
        </defs>

        <text
          className={styles.stroke}
          x="4"
          y="57"
          fill="none"
          stroke="var(--color-brand-hover)"
          strokeWidth="2.2"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{
            fontFamily: "inherit",
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: -1.5,
          }}
        >
          {CHARACTERS.map((character, index) => (
            <motion.tspan
              key={`${character}-${index}`}
              strokeDasharray={STROKE_DASH_LENGTH}
              initial={{
                strokeDashoffset: prefersReducedMotion
                  ? 0
                  : STROKE_DASH_LENGTH,
              }}
              animate={{ strokeDashoffset: 0 }}
              transition={
                prefersReducedMotion
                  ? { duration: 0 }
                  : {
                      delay: index * STAGGER,
                      duration: DRAW_DURATION,
                      ease: "easeOut",
                    }
              }
            >
              {character}
            </motion.tspan>
          ))}
        </text>

        <text
          className={styles.fill}
          x="4"
          y="57"
          fill="var(--color-ink)"
          clipPath={`url(#${clipId})`}
          style={{
            fontFamily: "inherit",
            fontSize: 64,
            fontWeight: 800,
            letterSpacing: -1.5,
          }}
        >
          {BRAND_NAME}
        </text>
      </svg>
    </span>
  );
}
