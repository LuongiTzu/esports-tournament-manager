"use client";

import {
  useCallback,
  useEffect,
  useRef,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import styles from "./BorderGlow.module.css";

interface BorderGlowProps {
  children?: ReactNode;
  className?: string;
  edgeSensitivity?: number;
  glowColor?: string;
  backgroundColor?: string;
  borderRadius?: number;
  glowRadius?: number;
  glowIntensity?: number;
  coneSpread?: number;
  animated?: boolean;
  colors?: string[];
  fillOpacity?: number;
}

type GlowStyle = CSSProperties & Record<`--${string}`, string | number>;

const GRADIENT_POSITIONS = [
  "80% 55%",
  "69% 34%",
  "8% 6%",
  "41% 38%",
  "86% 85%",
  "82% 18%",
  "51% 4%",
] as const;
const GRADIENT_KEYS = [
  "--gradient-one",
  "--gradient-two",
  "--gradient-three",
  "--gradient-four",
  "--gradient-five",
  "--gradient-six",
  "--gradient-seven",
] as const;
const COLOR_MAP = [0, 1, 2, 0, 1, 2, 1] as const;
const DEFAULT_COLORS = ["#c084fc", "#f472b6", "#38bdf8"];

function parseHsl(value: string) {
  const match = value.match(/([\d.]+)\s*([\d.]+)%?\s*([\d.]+)%?/);
  if (!match) return { hue: 40, saturation: 80, lightness: 80 };
  return {
    hue: Number.parseFloat(match[1]),
    saturation: Number.parseFloat(match[2]),
    lightness: Number.parseFloat(match[3]),
  };
}

function buildGlowVars(glowColor: string, intensity: number): GlowStyle {
  const { hue, saturation, lightness } = parseHsl(glowColor);
  const base = `${hue}deg ${saturation}% ${lightness}%`;
  const opacities = [100, 60, 50, 40, 30, 20, 10];
  const suffixes = ["", "-60", "-50", "-40", "-30", "-20", "-10"];
  const variables: GlowStyle = {};

  opacities.forEach((opacity, index) => {
    variables[`--glow-color${suffixes[index]}`] =
      `hsl(${base} / ${Math.min(opacity * intensity, 100)}%)`;
  });
  return variables;
}

function buildGradientVars(requestedColors: string[]): GlowStyle {
  const colors = requestedColors.length > 0 ? requestedColors : DEFAULT_COLORS;
  const variables: GlowStyle = {};

  GRADIENT_KEYS.forEach((key, index) => {
    const colorIndex = Math.min(COLOR_MAP[index], colors.length - 1);
    variables[key] =
      `radial-gradient(at ${GRADIENT_POSITIONS[index]}, ${colors[colorIndex]} 0, transparent 50%)`;
  });
  variables["--gradient-base"] = `linear-gradient(${colors[0]} 0 100%)`;
  return variables;
}

export default function BorderGlow({
  children,
  className = "",
  edgeSensitivity = 30,
  glowColor = "40 80 80",
  backgroundColor = "var(--color-surface-card)",
  borderRadius = 28,
  glowRadius = 40,
  glowIntensity = 1,
  coneSpread = 25,
  animated = false,
  colors = DEFAULT_COLORS,
  fillOpacity = 0.5,
}: BorderGlowProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const handlePointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const card = cardRef.current;
      if (!card) return;

      const rect = card.getBoundingClientRect();
      const centerX = rect.width / 2;
      const centerY = rect.height / 2;
      const deltaX = event.clientX - rect.left - centerX;
      const deltaY = event.clientY - rect.top - centerY;
      const scaleX =
        deltaX === 0 ? Number.POSITIVE_INFINITY : centerX / Math.abs(deltaX);
      const scaleY =
        deltaY === 0 ? Number.POSITIVE_INFINITY : centerY / Math.abs(deltaY);
      const edgeProximity = Math.min(
        Math.max(1 / Math.min(scaleX, scaleY), 0),
        1,
      );
      const angle = (Math.atan2(deltaY, deltaX) * 180) / Math.PI + 90;

      card.style.setProperty(
        "--edge-proximity",
        (edgeProximity * 100).toFixed(3),
      );
      card.style.setProperty(
        "--cursor-angle",
        `${angle < 0 ? angle + 360 : angle}deg`,
      );
    },
    [],
  );

  useEffect(() => {
    const card = cardRef.current;
    if (
      !animated ||
      !card ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    let animationFrame = 0;
    const duration = 4000;
    const startAngle = 110;
    const angleRange = 355;
    const startTime = performance.now();
    card.classList.add(styles.sweepActive);

    const tick = (now: number) => {
      const progress = Math.min((now - startTime) / duration, 1);
      const proximity = Math.sin(progress * Math.PI) * 100;
      card.style.setProperty("--edge-proximity", proximity.toFixed(3));
      card.style.setProperty(
        "--cursor-angle",
        `${startAngle + angleRange * progress}deg`,
      );

      if (progress < 1) animationFrame = requestAnimationFrame(tick);
      else card.classList.remove(styles.sweepActive);
    };

    animationFrame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(animationFrame);
      card.classList.remove(styles.sweepActive);
    };
  }, [animated]);

  const style: GlowStyle = {
    "--card-bg": backgroundColor,
    "--edge-sensitivity": edgeSensitivity,
    "--border-radius": `${borderRadius}px`,
    "--glow-padding": `${glowRadius}px`,
    "--cone-spread": coneSpread,
    "--fill-opacity": fillOpacity,
    ...buildGlowVars(glowColor, glowIntensity),
    ...buildGradientVars(colors),
  };

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      className={`${styles.card} ${className}`}
      style={style}
    >
      <span aria-hidden className={styles.edgeLight} />
      <div className={styles.inner}>{children}</div>
    </div>
  );
}
