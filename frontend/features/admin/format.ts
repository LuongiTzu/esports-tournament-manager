import type { Locale } from "@/features/locale/types";

export function adminLocaleTag(locale: Locale) {
  return locale === "vi" ? "vi-VN" : "en-US";
}

export function formatAdminDate(
  value: string | Date,
  locale: Locale,
  includeTime = false,
) {
  return new Intl.DateTimeFormat(adminLocaleTag(locale), {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  }).format(new Date(value));
}

export function formatAdminNumber(value: number, locale: Locale) {
  return value.toLocaleString(adminLocaleTag(locale));
}
