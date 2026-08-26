import type { ComponentType } from "react";
import { DesktopIcon, MoonIcon, SunIcon } from "@phosphor-icons/react";
import type { TranslationKey } from "@/features/locale/store";
import type { ThemeMode } from "@/features/theme/types";

export interface ThemeOption {
  mode: ThemeMode;
  label: TranslationKey;
  icon: ComponentType<{ size?: number; weight?: "bold" | "fill" }>;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { mode: "light", label: "theme.light", icon: SunIcon },
  { mode: "dark", label: "theme.dark", icon: MoonIcon },
  { mode: "system", label: "theme.system", icon: DesktopIcon },
];
