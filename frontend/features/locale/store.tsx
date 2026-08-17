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
import en from "@/features/locale/dictionaries/en";
import vi from "@/features/locale/dictionaries/vi";
import { isLocale, type Locale } from "@/features/locale/types";

const STORAGE_KEY = "etm-locale";
const dictionaries = { vi, en };
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getLocaleSnapshot(): Locale {
  const savedLocale = window.localStorage.getItem(STORAGE_KEY);
  return isLocale(savedLocale) ? savedLocale : "vi";
}

function getServerLocaleSnapshot(): Locale {
  return "vi";
}

export type TranslationKey = keyof typeof vi;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale = useSyncExternalStore(
    subscribe,
    getLocaleSnapshot,
    getServerLocaleSnapshot,
  );

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
    listeners.forEach((listener) => listener());
  }, []);

  const value = useMemo<LocaleContextValue>(
    () => ({
      locale,
      setLocale,
      t: (key) => dictionaries[locale][key],
    }),
    [locale, setLocale],
  );

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale must be used within LocaleProvider");
  return context;
}
