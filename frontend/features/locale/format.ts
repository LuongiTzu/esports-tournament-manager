import type { Locale } from "@/features/locale/types";

export function localeTag(locale: Locale) {
  return locale === "vi" ? "vi-VN" : "en-US";
}

export function formatLocalizedDate(
  value: string | Date,
  locale: Locale,
  options: Intl.DateTimeFormatOptions = { dateStyle: "medium" },
) {
  return new Intl.DateTimeFormat(localeTag(locale), options).format(
    typeof value === "string" ? new Date(value) : value,
  );
}

export function formatLocalizedNumber(value: number, locale: Locale) {
  return new Intl.NumberFormat(localeTag(locale)).format(value);
}
