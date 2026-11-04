"use client";

import { LoadingRegion, LoadingStatus, Skeleton } from "@/components/Loading";
import { useLocale } from "@/features/locale/store";

export default function Loading() {
  const { t } = useLocale();
  const label = t("common.loading");

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <LoadingStatus label={label} />
      <LoadingRegion label={label} className="mt-6 space-y-6">
        <Skeleton className="h-9 w-2/3 max-w-md" />
        <Skeleton className="h-4 w-1/2 max-w-xs" />
        <Skeleton className="h-64 w-full" />
      </LoadingRegion>
    </div>
  );
}
