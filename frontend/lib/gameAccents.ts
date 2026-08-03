import type { CSSProperties } from "react";

export interface Accent {
  accent: string;
  alt: string;
  onAccent: string;
}

/** Nhãn đặt trên nền accent luôn là màu tối — cả 6 accent đều đủ sáng để dùng chung quy tắc này */
const INK = "oklch(0.175 0.008 275)";

const NEUTRAL: Accent = {
  accent: "oklch(0.78 0.02 275)",
  alt: "oklch(0.78 0.02 275)",
  onAccent: INK,
};

const key = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

const ACCENTS: Record<string, Accent> = {
  [key("League of Legends")]: {
    accent: "oklch(0.74 0.145 250)",
    alt: "oklch(0.78 0.105 85)", // brass phẳng, không bao giờ dùng làm gradient
    onAccent: INK,
  },
  [key("Valorant")]: {
    accent: "oklch(0.70 0.185 22)",
    alt: "oklch(0.62 0.150 22)",
    onAccent: INK,
  },
  [key("CS:GO")]: {
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
  // Seed không có iconUrl nên không suy ra được màu — dùng tông trung tính
  [key("Liên Quân Mobile")]: NEUTRAL,
};

export function gameAccent(name?: string | null): Accent {
  return (name && ACCENTS[key(name)]) || NEUTRAL;
}

/** Spread vào `style` của phần tử bao ngoài; con cháu dùng bg-accent / text-accent / bg-accent/10 */
export function accentVars(name?: string | null): CSSProperties {
  const a = gameAccent(name);
  return {
    "--accent": a.accent,
    "--accent-alt": a.alt,
    "--on-accent": a.onAccent,
  } as CSSProperties;
}
