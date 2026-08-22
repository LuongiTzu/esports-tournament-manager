import Link from "next/link";
import { CheckCircleIcon, EyeIcon, XCircleIcon } from "@phosphor-icons/react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import type { AdminReport, AdminReportStatus } from "@/features/admin/types";
import { formatAdminDate } from "@/features/admin/format";
import { useLocale } from "@/features/locale/store";

const REASON_LABELS: Record<AdminReport["reason"], string> = {
  GAMBLING: "Cá cược",
  SCAM: "Lừa đảo",
  INAPPROPRIATE_CONTENT: "Nội dung không phù hợp",
  OTHER: "Khác",
};

const STATUS_LABELS: Record<AdminReportStatus, string> = {
  PENDING: "Chờ xử lý",
  REVIEWED: "Đã xem xét",
  DISMISSED: "Đã bỏ qua",
};

export default function AdminReportDetail({
  report,
  working,
  onReview,
}: {
  report: AdminReport;
  working: boolean;
  onReview: (status: "REVIEWED" | "DISMISSED") => void;
}) {
  const { locale } = useLocale();
  const formatDate = (value: string | null) =>
    value ? formatAdminDate(value, locale, true) : "—";
  return (
    <article className="rounded-2xl border border-line bg-surface-card p-5 shadow-sm lg:sticky lg:top-24">
      <p className="text-xs font-semibold uppercase tracking-wide text-brand">
        Report #{report.id.slice(-8)}
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-black text-ink">{REASON_LABELS[report.reason]}</h2>
        <span className="rounded-full border border-line bg-surface-sub px-2.5 py-1 text-xs font-semibold text-ink-muted">
          {STATUS_LABELS[report.status]}
        </span>
      </div>

      <section className="mt-5">
        <h3 className="text-sm font-bold text-ink">Nội dung báo cáo</h3>
        <p className="mt-2 whitespace-pre-wrap break-words rounded-xl border border-line bg-surface-sub p-4 text-sm leading-6 text-ink-muted">
          {report.description || "Người báo cáo không cung cấp mô tả bổ sung."}
        </p>
      </section>

      <dl className="mt-5 divide-y divide-line rounded-xl border border-line px-4 text-sm">
        <DetailRow label="Người báo cáo" value={report.reporter?.displayName ?? "Khách vãng lai"} />
        <DetailRow label="Tạo lúc" value={formatDate(report.createdAt)} />
        <DetailRow label="Xử lý lúc" value={formatDate(report.reviewedAt)} />
        <DetailRow label="Người xử lý" value={report.reviewer?.displayName ?? "—"} />
      </dl>

      <section className="mt-5 rounded-xl border border-line bg-surface-sub p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          Đối tượng được báo cáo
        </p>
        <p className="mt-2 font-bold text-ink">{report.tournament.name}</p>
        <p className="mt-1 break-all text-xs text-ink-faint">/{report.tournament.slug}</p>
        <div className="mt-3 flex flex-wrap gap-3">
          <Link
            href={`/tournaments/${report.tournament.slug}`}
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand hover:text-brand-hover"
          >
            <EyeIcon /> Xem giải đấu
          </Link>
          <Link
            href="/admin/tournaments"
            className="text-sm font-semibold text-ink-muted hover:text-ink"
          >
            Mở quản trị giải đấu
          </Link>
        </div>
      </section>

      {report.status === "PENDING" ? (
        <section className="mt-5 border-t border-line pt-5">
          <p className="text-xs leading-5 text-ink-faint">
            Xử lý báo cáo chỉ cập nhật workflow của báo cáo. Backend không tự ẩn hoặc thay đổi giải đấu.
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={working}
              onClick={() => onReview("REVIEWED")}
              className={primaryButtonClass}
            >
              <CheckCircleIcon /> {working ? "Đang xử lý..." : "Đánh dấu đã xem xét"}
            </button>
            <button
              type="button"
              disabled={working}
              onClick={() => onReview("DISMISSED")}
              className={secondaryButtonClass}
            >
              <XCircleIcon /> Bỏ qua báo cáo
            </button>
          </div>
        </section>
      ) : (
        <p className="mt-5 rounded-xl border border-line bg-surface-sub px-4 py-3 text-xs leading-5 text-ink-muted">
          Backend chỉ cho phép xử lý báo cáo đang ở trạng thái PENDING; báo cáo này hiện chỉ đọc.
        </p>
      )}
    </article>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <dt className="text-ink-faint">{label}</dt>
      <dd className="text-right text-ink-muted">{value}</dd>
    </div>
  );
}
