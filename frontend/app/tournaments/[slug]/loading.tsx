"use client";

import TournamentDetailSkeleton from "@/features/tournaments/components/TournamentDetailSkeleton";
import { useLocale } from "@/features/locale/store";

export default function Loading() {
  const { t } = useLocale();
  return <TournamentDetailSkeleton label={t("common.loading")} />;
}
