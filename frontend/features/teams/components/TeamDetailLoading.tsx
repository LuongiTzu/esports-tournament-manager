"use client";

import { useLocale } from "@/features/locale/store";

export default function TeamDetailLoading() {
  const { t } = useLocale();
  return (
    <div
      role="status"
      className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
    >
      <span className="sr-only">{t("common.loading")}</span>
      <div aria-hidden="true" className="space-y-6 motion-safe:animate-pulse">
        <div className="h-5 w-48 rounded bg-surface-sub" />
        <div className="h-64 border border-line bg-surface-card" />
        <div className="grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-5">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="h-24 bg-surface-card" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="h-96 border border-line bg-surface-card p-6">
            <div className="mb-6 h-6 w-40 bg-surface-sub" />
            <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: 4 }, (_, index) => (
                <div key={index} className="h-28 rounded-lg bg-surface-sub" />
              ))}
            </div>
          </div>
          <div className="h-64 border border-line bg-surface-card" />
        </div>
      </div>
    </div>
  );
}
