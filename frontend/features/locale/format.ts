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

export function formatRelativeDate(
  value: string | Date,
  locale: Locale,
  now = new Date(),
) {
  const date = typeof value === "string" ? new Date(value) : value;
  const differenceInSeconds = (date.getTime() - now.getTime()) / 1000;
  const absoluteSeconds = Math.abs(differenceInSeconds);
  const formatter = new Intl.RelativeTimeFormat(localeTag(locale), {
    numeric: "auto",
  });

  if (absoluteSeconds < 60) {
    return formatter.format(Math.round(differenceInSeconds), "second");
  }
  if (absoluteSeconds < 60 * 60) {
    return formatter.format(Math.round(differenceInSeconds / 60), "minute");
  }
  if (absoluteSeconds < 24 * 60 * 60) {
    return formatter.format(Math.round(differenceInSeconds / 3600), "hour");
  }
  if (absoluteSeconds < 7 * 24 * 60 * 60) {
    return formatter.format(Math.round(differenceInSeconds / 86400), "day");
  }

  return formatLocalizedDate(date, locale, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}
