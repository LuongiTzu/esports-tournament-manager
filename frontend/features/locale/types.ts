export const LOCALES = ["vi", "en"] as const;

export type Locale = (typeof LOCALES)[number];

export function isLocale(value: string | null): value is Locale {
  return value !== null && LOCALES.includes(value as Locale);
}
