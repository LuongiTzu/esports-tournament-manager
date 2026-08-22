"use client";

import { useEffect, useMemo, useState } from "react";
import { FlagIcon, XIcon } from "@phosphor-icons/react";
import { adminApi } from "@/features/admin/api";
import type { AdminReport, AdminReportsQuery, AdminReportStatus } from "@/features/admin/types";
import { alertErrorClass, inputClass, secondaryButtonClass } from "@/components/ui";
import AdminReportList from "@/features/admin/components/AdminReportList";
import AdminReportDetail from "@/features/admin/components/AdminReportDetail";
import { formatAdminNumber } from "@/features/admin/format";
import { useLocale } from "@/features/locale/store";

function queryKey(query: AdminReportsQuery) {
  return query.status ?? "ALL";
}

export default function AdminReportsPage() {
  const { locale } = useLocale();
  const [query, setQuery] = useState<AdminReportsQuery>({});
  const [reloadKey, setReloadKey] = useState(0);
  const [result, setResult] = useState<{ key: string; reports: AdminReport[] } | null>(null);
  const [selectedId, setSelectedId] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const currentKey = queryKey(query);

  useEffect(() => {
    let cancelled = false;
    adminApi.listReports(query).then((reports) => {
      if (cancelled) return;
      setResult({ key: currentKey, reports });
      setSelectedId((current) => reports.some((item) => item.id === current) ? current : (reports[0]?.id ?? ""));
      setError("");
    }).catch((reason: unknown) => {
      if (!cancelled) setError(reason instanceof Error ? reason.message : "Không tải được báo cáo.");
    });
    return () => { cancelled = true; };
  }, [currentKey, query, reloadKey]);

  const loading = result?.key !== currentKey && !error;
  const reports = result?.key === currentKey ? result.reports : null;
  const selected = useMemo(() => reports?.find((item) => item.id === selectedId) ?? null, [reports, selectedId]);

  const refetch = async () => {
    const refreshed = await adminApi.listReports(query);
    setResult({ key: currentKey, reports: refreshed });
    setSelectedId((current) => refreshed.some((item) => item.id === current) ? current : (refreshed[0]?.id ?? ""));
  };

  const review = async (status: "REVIEWED" | "DISMISSED") => {
    if (!selected || working) return;
    const label = status === "REVIEWED" ? "đánh dấu đã xem xét" : "bỏ qua";
    if (!window.confirm(`Xác nhận ${label} báo cáo này?`)) return;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await adminApi.reviewReport(selected.id, status);
      await refetch();
      setNotice(status === "REVIEWED" ? "Đã đánh dấu báo cáo là đã xem xét." : "Đã bỏ qua báo cáo.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể xử lý báo cáo.");
    } finally {
      setWorking(false);
    }
  };

  return (
    <div>
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Report review</p>
        <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">Báo cáo vi phạm</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-ink-muted">
          Xem báo cáo giải đấu và xử lý workflow theo đúng trạng thái backend. Việc kiểm duyệt giải là thao tác riêng.
        </p>
      </header>

      <div className="mt-5 flex flex-wrap gap-3 rounded-2xl border border-line bg-surface-card p-4">
        <label className="min-w-56 flex-1 sm:max-w-xs">
          <span className="sr-only">Trạng thái báo cáo</span>
          <select
            value={query.status ?? "ALL"}
            onChange={(event) => {
              setQuery({ status: event.target.value === "ALL" ? undefined : event.target.value as AdminReportStatus });
              setNotice("");
              setError("");
            }}
            className={inputClass}
          >
            <option value="ALL">Mọi trạng thái báo cáo</option>
            <option value="PENDING">Chờ xử lý</option>
            <option value="REVIEWED">Đã xem xét</option>
            <option value="DISMISSED">Đã bỏ qua</option>
          </select>
        </label>
        {query.status && (
          <button type="button" onClick={() => setQuery({})} className={secondaryButtonClass}>
            <XIcon /> Xóa bộ lọc
          </button>
        )}
        <p className="basis-full text-xs text-ink-faint">Backend hỗ trợ lọc theo trạng thái; chưa có phân trang hoặc bộ lọc loại đối tượng.</p>
      </div>

      {notice && <p role="status" className="mt-4 rounded-xl border border-approved/30 bg-approved/10 px-4 py-3 text-sm text-approved">{notice}</p>}
      {error && (
        <div className="mt-4">
          <p role="alert" className={alertErrorClass}>{error}</p>
          {!reports && <button type="button" onClick={() => { setError(""); setReloadKey((value) => value + 1); }} className={`${secondaryButtonClass} mt-3`}>Thử lại</button>}
        </div>
      )}

      {loading ? (
        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_23rem]"><div className="h-96 animate-pulse rounded-2xl bg-surface-card" /><div className="h-96 animate-pulse rounded-2xl bg-surface-card" /></div>
      ) : reports ? reports.length === 0 ? (
        <div className="mt-5 rounded-2xl border border-dashed border-line px-6 py-16 text-center"><FlagIcon size={36} className="mx-auto text-ink-faint" /><p className="mt-3 font-semibold text-ink">Không có báo cáo phù hợp</p></div>
      ) : (
        <><p className="mt-4 text-sm text-ink-faint">{formatAdminNumber(reports.length, locale)} báo cáo · mới nhất trước</p><div className="mt-3 grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_23rem] lg:items-start"><AdminReportList reports={reports} selectedId={selectedId} onSelect={(id) => { setSelectedId(id); setNotice(""); setError(""); }} />{selected && <AdminReportDetail report={selected} working={working} onReview={review} />}</div></>
      ) : null}
    </div>
  );
}
