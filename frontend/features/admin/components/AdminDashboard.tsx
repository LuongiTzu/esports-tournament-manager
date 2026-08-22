"use client";

import { useEffect, useState, type ComponentType } from "react";
import {
  ArrowClockwiseIcon,
  CalendarPlusIcon,
  FlagIcon,
  LockKeyIcon,
  ShieldWarningIcon,
  TrophyIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { adminApi } from "@/features/admin/api";
import type { AdminDashboardStats } from "@/features/admin/types";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import { adminLocaleTag, formatAdminNumber } from "@/features/admin/format";
import { useLocale } from "@/features/locale/store";
import type { Locale } from "@/features/locale/types";

interface MetricCardProps {
  label: string;
  value: number;
  helper: string;
  locale: Locale;
  icon: ComponentType<{ size?: number; weight?: "duotone" }>;
  tone?: "brand" | "danger" | "warning";
}

function MetricCard({ label, value, helper, locale, icon: Icon, tone = "brand" }: MetricCardProps) {
  const toneClass = {
    brand: "bg-brand/12 text-brand",
    danger: "bg-rejected/12 text-rejected",
    warning: "bg-pending/12 text-pending",
  }[tone];

  return (
    <article className="rounded-2xl border border-line bg-surface-card p-4 shadow-sm sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-ink-muted">{label}</p>
          <p className="mt-2 font-mono text-3xl font-black tracking-tight text-ink">{formatAdminNumber(value, locale)}</p>
        </div>
        <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${toneClass}`}>
          <Icon size={21} weight="duotone" />
        </span>
      </div>
      <p className="mt-3 text-xs leading-5 text-ink-faint">{helper}</p>
    </article>
  );
}

function DashboardSkeleton() {
  return (
    <div aria-label="Đang tải dữ liệu tổng quan" className="space-y-5">
      <div className="h-28 animate-pulse rounded-2xl border border-line bg-surface-card" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-2xl border border-line bg-surface-card" />
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { locale } = useLocale();
  const [result, setResult] = useState<{
    stats: AdminDashboardStats;
    loadedAt: Date;
  } | null>(null);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .getDashboardStats()
      .then((stats) => {
        if (cancelled) return;
        setResult({ stats, loadedAt: new Date() });
        setError("");
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setError(reason instanceof Error ? reason.message : "Không tải được dữ liệu quản trị.");
        }
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setError("");
    setRefreshKey((key) => key + 1);
  };

  if (!result && !error) return <DashboardSkeleton />;

  if (!result) {
    return (
      <div className="rounded-2xl border border-line bg-surface-card p-5 sm:p-6">
        <p className={alertErrorClass}>{error}</p>
        <button type="button" onClick={refresh} disabled={refreshing} className={`${secondaryButtonClass} mt-4`}>
          <ArrowClockwiseIcon /> Thử lại
        </button>
      </div>
    );
  }

  const { stats, loadedAt } = result;

  return (
    <div>
      <header className="flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-line bg-surface-card p-5 shadow-sm sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">Platform overview</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-ink sm:text-3xl">Tổng quan hệ thống</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-ink-muted">
            Số liệu vận hành hiện tại từ hệ thống quản trị. Không bao gồm phân tích xu hướng lịch sử.
          </p>
        </div>
        <div className="text-right">
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className={`${secondaryButtonClass} min-h-10 px-3 py-2`}
          >
            <ArrowClockwiseIcon className={refreshing ? "animate-spin" : ""} />
            {refreshing ? "Đang làm mới" : "Làm mới"}
          </button>
          <p className="mt-2 text-xs text-ink-faint">
            Cập nhật {loadedAt.toLocaleTimeString(adminLocaleTag(locale), { hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </header>

      {error && <p className={`${alertErrorClass} mt-4`}>Dữ liệu cũ vẫn được hiển thị. Làm mới thất bại: {error}</p>}

      <section aria-labelledby="platform-metrics" className="mt-5">
        <h2 id="platform-metrics" className="sr-only">Chỉ số nền tảng</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard locale={locale} label="Người dùng" value={stats.totalUsers} helper="Tổng số tài khoản trên nền tảng" icon={UsersThreeIcon} />
          <MetricCard locale={locale} label="Giải đấu" value={stats.totalTournaments} helper="Tổng số giải ở mọi trạng thái" icon={TrophyIcon} />
          <MetricCard locale={locale} label="Giải mới trong 7 ngày" value={stats.tournamentsCreatedLast7Days} helper="Dựa trên thời điểm tạo giải" icon={CalendarPlusIcon} />
          <MetricCard locale={locale} label="Giải có báo cáo chờ xử lý" value={stats.tournamentsBeingReported} helper="Số giải riêng biệt có báo cáo PENDING" icon={FlagIcon} tone="warning" />
          <MetricCard locale={locale} label="Giải bị ẩn" value={stats.lockedTournaments} helper="Giải đang HIDDEN_BY_ADMIN" icon={ShieldWarningIcon} tone="danger" />
          <MetricCard locale={locale} label="Tài khoản bị khóa" value={stats.lockedAccounts} helper="Tài khoản đang bị hạn chế đăng nhập" icon={LockKeyIcon} tone="danger" />
        </div>
      </section>

      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <section className="rounded-2xl border border-line bg-surface-card p-5">
          <h2 className="font-bold text-ink">Tình hình giải đấu</h2>
          <dl className="mt-4 divide-y divide-line text-sm">
            <SummaryRow locale={locale} label="Tổng số giải" value={stats.totalTournaments} />
            <SummaryRow locale={locale} label="Tạo trong 7 ngày gần nhất" value={stats.tournamentsCreatedLast7Days} />
            <SummaryRow locale={locale} label="Đang bị ẩn bởi quản trị viên" value={stats.lockedTournaments} />
            <SummaryRow locale={locale} label="Có báo cáo chờ xử lý" value={stats.tournamentsBeingReported} />
          </dl>
        </section>
        <section className="rounded-2xl border border-line bg-surface-card p-5">
          <h2 className="font-bold text-ink">Tài khoản nền tảng</h2>
          <dl className="mt-4 divide-y divide-line text-sm">
            <SummaryRow locale={locale} label="Tổng tài khoản" value={stats.totalUsers} />
            <SummaryRow locale={locale} label="Tài khoản đang khóa" value={stats.lockedAccounts} />
          </dl>
          <p className="mt-4 rounded-xl bg-surface-sub px-3 py-2.5 text-xs leading-5 text-ink-muted">
            Organizer được xác định qua quyền sở hữu giải đấu, không phải một vai trò tài khoản riêng.
          </p>
        </section>
      </div>
    </div>
  );
}

function SummaryRow({ label, value, locale }: { label: string; value: number; locale: Locale }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 first:pt-0 last:pb-0">
      <dt className="text-ink-muted">{label}</dt>
      <dd className="font-mono font-bold text-ink">{formatAdminNumber(value, locale)}</dd>
    </div>
  );
}
