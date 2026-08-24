import { FlagIcon, UserCircleIcon } from "@phosphor-icons/react";
import type { AdminReport } from "@/features/admin/types";
import { formatAdminDate } from "@/features/admin/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";

export default function AdminReportList({
  reports,
  selectedId,
  onSelect,
}: {
  reports: AdminReport[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { locale, t } = useLocale();
  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-surface-card">
      <div className="hidden grid-cols-[minmax(13rem,1fr)_minmax(11rem,1fr)_9rem] gap-3 border-b border-line bg-surface-sub/60 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-ink-faint md:grid">
        <span>{t("admin.reports.listHeading")}</span>
        <span>{t("admin.tournaments.listHeading")}</span>
        <span>{t("admin.reports.status")}</span>
      </div>
      <div className="divide-y divide-line">
        {reports.map((report) => {
          const selected = report.id === selectedId;
          return (
            <button
              key={report.id}
              type="button"
              onClick={() => onSelect(report.id)}
              aria-pressed={selected}
              className={`grid w-full gap-3 px-4 py-4 text-left transition md:grid-cols-[minmax(13rem,1fr)_minmax(11rem,1fr)_9rem] md:items-center ${
                selected ? "bg-brand/10" : "hover:bg-surface-hover"
              }`}
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2 font-semibold text-ink">
                  <FlagIcon className="shrink-0 text-brand" weight="fill" />
                  {t(`admin.report.reason.${report.reason}` as TranslationKey)}
                </span>
                <span className="mt-1 flex min-w-0 items-center gap-1 text-xs text-ink-faint">
                  <UserCircleIcon className="shrink-0" />
                  <span className="truncate">
                    {report.reporter?.displayName ?? t("admin.reports.guest")}
                  </span>
                </span>
              </span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-ink-muted">
                  {report.tournament.name}
                </span>
                <span className="block truncate text-xs text-ink-faint">
                  {formatAdminDate(report.createdAt, locale)}
                </span>
              </span>
              <span
                className={`w-fit rounded-full px-2.5 py-1 text-xs font-semibold ${
                  report.status === "PENDING"
                    ? "bg-warning/12 text-warning"
                    : report.status === "REVIEWED"
                      ? "bg-approved/12 text-approved"
                      : "bg-surface-sub text-ink-muted"
                }`}
              >
                {t(`admin.report.status.${report.status}` as TranslationKey)}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
