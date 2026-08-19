import type { CSSProperties } from "react";

export interface Accent {
  accent: string;
  alt: string;
  onAccent: string;
}

const INK = "oklch(0.175 0.008 275)";

const NEUTRAL: Accent = {
  accent: "oklch(0.78 0.02 275)",
  alt: "oklch(0.78 0.02 275)",
  onAccent: INK,
};

const key = (value: string) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

const ACCENTS: Record<string, Accent> = {
  [key("League of Legends")]: {
    accent: "oklch(0.74 0.145 250)",
    alt: "oklch(0.78 0.105 85)",
    onAccent: INK,
  },
  [key("Valorant")]: {
    accent: "oklch(0.70 0.185 22)",
    alt: "oklch(0.62 0.150 22)",
    onAccent: INK,
  },
  [key("Counter-Strike 2")]: {
    accent: "oklch(0.77 0.150 62)",
    alt: "oklch(0.43 0.020 62)",
    onAccent: INK,
  },
  [key("Dota 2")]: {
    accent: "oklch(0.68 0.165 358)",
    alt: "oklch(0.48 0.130 358)",
    onAccent: INK,
  },
  [key("FC Online")]: {
    accent: "oklch(0.79 0.155 158)",
    alt: "oklch(0.62 0.130 158)",
    onAccent: INK,
  },
  [key("Rocket League")]: {
    accent: "oklch(0.72 0.16 240)",
    alt: "oklch(0.76 0.14 65)",
    onAccent: INK,
  },
  [key("Tekken 8")]: {
    accent: "oklch(0.68 0.2 20)",
    alt: "oklch(0.72 0.16 300)",
    onAccent: INK,
  },
  [key("Street Fighter 6")]: {
    accent: "oklch(0.72 0.17 250)",
    alt: "oklch(0.76 0.17 80)",
    onAccent: INK,
  },
  [key("Liên Quân Mobile")]: NEUTRAL,
};

export function gameAccent(name?: string | null): Accent {
  return (name && ACCENTS[key(name)]) || NEUTRAL;
}

export function accentVars(name?: string | null): CSSProperties {
  const accent = gameAccent(name);
  return {
    "--accent": accent.accent,
    "--accent-alt": accent.alt,
    "--on-accent": accent.onAccent,
  } as CSSProperties;
}
