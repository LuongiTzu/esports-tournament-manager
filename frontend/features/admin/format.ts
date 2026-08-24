import type { Locale } from "@/features/locale/types";
import {
  formatLocalizedDate,
  formatLocalizedNumber,
} from "@/features/locale/format";

export function formatAdminDate(
  value: string | Date,
  locale: Locale,
  includeTime = false,
) {
  return formatLocalizedDate(value, locale, {
    dateStyle: "medium",
    ...(includeTime ? { timeStyle: "short" as const } : {}),
  });
}

export function formatAdminNumber(value: number, locale: Locale) {
  return formatLocalizedNumber(value, locale);
}
