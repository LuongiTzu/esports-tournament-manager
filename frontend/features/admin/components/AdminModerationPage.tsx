"use client";

import { useState } from "react";
import AdminCommentsPanel from "@/features/admin/components/AdminCommentsPanel";
import AdminRatingsPanel from "@/features/ratings/components/AdminRatingsPanel";
import BannedKeywordManagement from "@/features/admin/components/BannedKeywordManagement";
import { useLocale } from "@/features/locale/store";

export default function AdminModerationPage() {
  const { t } = useLocale();
  const [section, setSection] = useState<"COMMENTS" | "RATINGS" | "KEYWORDS">(
    "COMMENTS",
  );
  const sections = [
    { value: "COMMENTS", label: t("admin.moderation.commentsTab") },
    { value: "RATINGS", label: t("admin.moderation.ratingsTab") },
    { value: "KEYWORDS", label: t("admin.moderation.keywordsTab") },
  ] as const;

  return (
    <div>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
          {t("admin.moderation.eyebrow")}
        </p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">
          {t("admin.moderation.title")}
        </h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
          {t("admin.moderation.description")}
        </p>
      </header>
      <div
        role="tablist"
        aria-label={t("admin.moderation.title")}
        className="mt-5 flex gap-2 overflow-x-auto rounded-xl border border-line bg-surface-card/75 p-1.5"
      >
        {sections.map((item) => {
          const active = section === item.value;
          return (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`admin-moderation-${item.value.toLowerCase()}`}
              onClick={() => setSection(item.value)}
              className={`min-h-10 shrink-0 rounded-lg px-4 text-sm font-bold transition ${
                active
                  ? "bg-brand-secondary text-on-brand shadow-sm"
                  : "text-ink-muted hover:bg-surface-hover hover:text-ink"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>
      <div
        id={`admin-moderation-${section.toLowerCase()}`}
        role="tabpanel"
        className="mt-5"
      >
        {section === "COMMENTS" && <AdminCommentsPanel />}
        {section === "RATINGS" && <AdminRatingsPanel />}
        {section === "KEYWORDS" && <BannedKeywordManagement />}
      </div>
    </div>
  );
}
