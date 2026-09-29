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
import {
  isLocale,
  LOCALE_COOKIE,
  type Locale,
} from "@/features/locale/types";

const STORAGE_KEY = LOCALE_COOKIE;
const dictionaries = { vi, en };
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getLocaleSnapshot(): Locale {
  const savedLocale = window.localStorage.getItem(STORAGE_KEY);
  if (isLocale(savedLocale)) return savedLocale;
  const cookieLocale = document.cookie
    .split(";")
    .map((item) => item.trim())
    .find((item) => item.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1);
  const normalizedCookieLocale = cookieLocale ?? null;
  return isLocale(normalizedCookieLocale) ? normalizedCookieLocale : "vi";
}

export type TranslationKey = keyof typeof vi;

interface LocaleContextValue {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey) => string;
}

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({
  children,
  initialLocale = "vi",
}: {
  children: ReactNode;
  initialLocale?: Locale;
}) {
  const locale = useSyncExternalStore(
    subscribe,
    getLocaleSnapshot,
    () => initialLocale,
  );

  useEffect(() => {
    document.documentElement.lang = locale;
    document.cookie = `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=31536000; SameSite=Lax`;
  }, [locale]);

  const setLocale = useCallback((nextLocale: Locale) => {
    window.localStorage.setItem(STORAGE_KEY, nextLocale);
    document.cookie = `${LOCALE_COOKIE}=${nextLocale}; Path=/; Max-Age=31536000; SameSite=Lax`;
    document.documentElement.lang = nextLocale;
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
