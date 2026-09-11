"use client";

import { ManagementPageSkeleton } from "@/features/tournaments/components/manage/ManagementSkeletons";
import { useLocale } from "@/features/locale/store";

export default function Loading() {
  const { t } = useLocale();
  return <ManagementPageSkeleton label={t("common.loading")} />;
}
