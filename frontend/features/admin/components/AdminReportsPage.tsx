"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FlagIcon, XIcon } from "@phosphor-icons/react";
import { adminApi } from "@/features/admin/api";
import type { AdminReport, AdminReportsQuery, AdminReportStatus } from "@/features/admin/types";
import { alertErrorClass, inputClass, secondaryButtonClass } from "@/components/ui";
import AdminReportList from "@/features/admin/components/AdminReportList";
import AdminReportDetail from "@/features/admin/components/AdminReportDetail";
import { formatAdminNumber } from "@/features/admin/format";
import { useLocale } from "@/features/locale/store";
import { selectAvailableItemId } from "@/features/admin/selection";

function queryKey(query: AdminReportsQuery) {
  return query.status ?? "ALL";
}

export default function AdminReportsPage() {
  const { locale, t } = useLocale();
  const [query, setQuery] = useState<AdminReportsQuery>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<{ key: string; reports: AdminReport[] } | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const currentKey = queryKey(query);
  const currentKeyRef = useRef(currentKey);
  useEffect(() => {
    currentKeyRef.current = currentKey;
  }, [currentKey]);

  useEffect(() => {
    let cancelled = false;
    adminApi.listReports(query).then((reports) => {
      if (cancelled) return;
      setResult({ key: currentKey, reports });
      setSelectedId((current) => selectAvailableItemId(reports, current));
      setError("");
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : t("admin.reports.loadError"));
    });
    return () => { cancelled = true; };
  }, [currentKey, query, reloadKey, t]);

  const loading = result?.key !== currentKey && !error;
  const reports = result?.key === currentKey ? result.reports : null;
  const selected = useMemo(() => reports?.find((item) => item.id === selectedId) ?? null, [reports, selectedId]);

  const refetch = async () => {
    const requestedKey = currentKey;
    const refreshed = await adminApi.listReports(query);
    if (currentKeyRef.current !== requestedKey) return;
    setResult({ key: currentKey, reports: refreshed });
    setSelectedId((current) => selectAvailableItemId(refreshed, current));
  };

  const review = async (status: "REVIEWED" | "DISMISSED") => {
    if (!selected || working) return;
    const label = status === "REVIEWED" ? t("admin.reports.reviewAction") : t("admin.reports.dismissAction");
    if (!window.confirm(`${t("admin.reports.confirmPrefix")} ${label} ${t("admin.reports.confirmSuffix")}`)) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await adminApi.reviewReport(selected.id, status);
      await refetch();
      setNotice(status === "REVIEWED" ? t("admin.reports.reviewedNotice") : t("admin.reports.dismissedNotice"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : t("admin.reports.updateError"));
    } finally {
      setWorking(false);
    }
  };

  return (
    <div>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">{t("admin.reports.eyebrow")}</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">{t("admin.reports.title")}</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
          {t("admin.reports.description")}
        </p>
      </header>

      <div className="mt-5 flex flex-wrap gap-3 rounded-2xl border border-line bg-surface-card p-4">
        <label className="min-w-56 flex-1 sm:max-w-xs">
          <span className="sr-only">{t("admin.reports.filterAria")}</span>
          <select
            value={query.status ?? "ALL"}
            onChange={(event) => {
              setQuery({ status: event.target.value === "ALL" ? undefined : event.target.value as AdminReportStatus });
              setNotice("");
              setError("");
            }}
            className={inputClass}
          >
            <option value="ALL">{t("admin.reports.allStatuses")}</option>
            <option value="PENDING">{t("admin.report.status.PENDING")}</option>
            <option value="REVIEWED">{t("admin.report.status.REVIEWED")}</option>
            <option value="DISMISSED">{t("admin.report.status.DISMISSED")}</option>
          </select>
        </label>
        {query.status && (
          <button type="button" onClick={() => setQuery({})} className={secondaryButtonClass}>
            <XIcon /> {t("admin.users.clearFilters")}
          </button>
        )}
        <p className="basis-full text-xs text-ink-faint">{t("admin.reports.filterLimitation")}</p>
      </div>

      {notice && <p role="status" className="mt-4 rounded-xl border border-approved/30 bg-approved/10 px-4 py-3 text-sm text-approved">{notice}</p>}
      {error && (
        <div className="mt-4">
          <p role="alert" className={alertErrorClass}>{error}</p>
          {!reports && <button type="button" onClick={() => { setError(""); setReloadKey((value) => value + 1); }} className={`${secondaryButtonClass} mt-3`}>{t("common.retry")}</button>}
        </div>
      )}

      {loading ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]"><div className="h-96 animate-pulse rounded-2xl bg-surface-card" /><div className="h-96 animate-pulse rounded-2xl bg-surface-card" /></div>
      ) : reports ? reports.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-line px-6 py-16 text-center"><FlagIcon size={36} className="mx-auto text-ink-faint" /><p className="mt-3 font-semibold text-ink">{t("admin.reports.empty")}</p></div>
      ) : (
        <><p className="mt-4 text-sm text-ink-faint">{formatAdminNumber(reports.length, locale)} {t("admin.reports.unit")} · {t("admin.reports.newestFirst")}</p><div className="mt-3 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start"><AdminReportList reports={reports} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setNotice(""); setError(""); }} />{selected && <AdminReportDetail report={selected} working={working} onReview={review} />}</div></>
      ) : null}
    </div>
  );
}
