"use client";

import AdminCommentsPanel from "@/features/admin/components/AdminCommentsPanel";
import BannedKeywordManagement from "@/features/admin/components/BannedKeywordManagement";
import { useLocale } from "@/features/locale/store";

export default function AdminModerationPage() {
  const { t } = useLocale();
  return (
    <div>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{t("admin.moderation.eyebrow")}</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">{t("admin.moderation.title")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
          {t("admin.moderation.description")}
        </p>
      </header>
      <div className="mt-5 space-y-5">
        <AdminCommentsPanel />
        <BannedKeywordManagement />
      </div>
    </div>
  );
}
