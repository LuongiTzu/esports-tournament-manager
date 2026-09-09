"use client";

import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";
import { useLocale } from "@/features/locale/store";

export default function QualificationBadge() {
  const { t } = useLocale();

  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border border-approved/25 bg-approved/10 px-2 py-0.5 text-[10px] font-bold leading-4 text-approved">
      <CheckCircleIcon size={12} weight="fill" className="shrink-0" aria-hidden />
      {t("standings.qualified")}
    </span>
  );
}
