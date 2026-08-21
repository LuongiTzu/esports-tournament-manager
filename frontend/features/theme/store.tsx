"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { isThemeMode, type ResolvedTheme, type ThemeMode } from "@/features/theme/types";

export const THEME_STORAGE_KEY = "etm-theme";
const themeListeners = new Set<() => void>();

function subscribeToPreference(listener: () => void) {
  themeListeners.add(listener);
  const handleStorage = (event: StorageEvent) => {
    if (event.key === THEME_STORAGE_KEY) listener();
  };
  window.addEventListener("storage", handleStorage);
  return () => {
    themeListeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function getPreferenceSnapshot(): ThemeMode {
  const saved = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeMode(saved) ? saved : "dark";
}

function getServerPreferenceSnapshot(): ThemeMode {
  return "dark";
}

function subscribeToSystemTheme(listener: () => void) {
  const query = window.matchMedia("(prefers-color-scheme: dark)");
  query.addEventListener("change", listener);
  return () => query.removeEventListener("change", listener);
}

function getSystemThemeSnapshot(): ResolvedTheme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function getServerSystemThemeSnapshot(): ResolvedTheme {
  return "dark";
}

interface ThemeContextValue {
  mode: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const mode = useSyncExternalStore(subscribeToPreference, getPreferenceSnapshot, getServerPreferenceSnapshot);
  const systemTheme = useSyncExternalStore(
    subscribeToSystemTheme,
    getSystemThemeSnapshot,
    getServerSystemThemeSnapshot,
  );
  const resolvedTheme = mode === "system" ? systemTheme : mode;

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.theme = resolvedTheme;
    root.dataset.themePreference = mode;
    root.style.colorScheme = resolvedTheme;
  }, [mode, resolvedTheme]);

  const setMode = useCallback((nextMode: ThemeMode) => {
    window.localStorage.setItem(THEME_STORAGE_KEY, nextMode);
    themeListeners.forEach((listener) => listener());
  }, []);

  const value = useMemo(() => ({ mode, resolvedTheme, setMode }), [mode, resolvedTheme, setMode]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error("useTheme must be used within ThemeProvider");
  return context;
}
