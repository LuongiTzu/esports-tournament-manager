"use client";

import { useLocale } from "@/features/locale/store";

export default function TeamDetailLoading() {
  const { t } = useLocale();
  return (
    <div role="status" className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
        <div className="h-5 w-48 rounded bg-surface-sub" />
        <div className="h-48 rounded-2xl border border-line bg-surface-card" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-24 rounded-xl bg-surface-sub" />
          ))}
        </div>
        <div className="h-72 rounded-2xl border border-line bg-surface-card" />
      </div>
    </div>
  );
}
