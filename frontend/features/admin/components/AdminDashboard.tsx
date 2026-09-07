"use client";

import { useEffect, useState } from "react";
import { ArrowClockwiseIcon, ShieldCheckIcon } from "@phosphor-icons/react";
import { adminApi } from "@/features/admin/api";
import type {
  AdminDashboardPeriod,
  AdminDashboardStats,
} from "@/features/admin/types";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import { formatAdminNumber } from "@/features/admin/format";
import { localeTag } from "@/features/locale/format";
import { useLocale } from "@/features/locale/store";
import AdminDashboardKpis from "@/features/admin/components/dashboard/AdminDashboardKpis";
import {
  GrowthTrendChart,
  PopularGamesChart,
  TournamentStatusDistribution,
} from "@/features/admin/components/dashboard/AdminDashboardCharts";
import {
  AttentionQueue,
  RecentReports,
  RecentTournaments,
} from "@/features/admin/components/dashboard/AdminDashboardLists";

function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div aria-label={label} className="space-y-5">
      <div className="h-24 animate-pulse rounded-xl border border-line bg-surface-card/70" />
      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div
            key={index}
            className="h-44 animate-pulse rounded-xl border border-line bg-surface-card/70"
          />
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="h-96 animate-pulse rounded-xl border border-line bg-surface-card/70 xl:col-span-2" />
        <div className="h-96 animate-pulse rounded-xl border border-line bg-surface-card/70" />
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { locale, t } = useLocale();
  const [periodDays, setPeriodDays] = useState<AdminDashboardPeriod>(7);
  const [refreshKey, setRefreshKey] = useState(0);
  const [result, setResult] = useState<{
    periodDays: AdminDashboardPeriod;
    stats: AdminDashboardStats;
    loadedAt: Date;
  } | null>(null);
  const requestKey = `${periodDays}:${refreshKey}`;
  const [requestState, setRequestState] = useState<{
    key: string;
    error: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    adminApi
      .getDashboardStats(periodDays)
      .then((stats) => {
        if (cancelled) return;
        setResult({ periodDays, stats, loadedAt: new Date() });
        setRequestState({ key: requestKey, error: "" });
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setRequestState({
          key: requestKey,
          error:
            reason instanceof Error
              ? reason.message
              : t("admin.dashboard.loadError"),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [periodDays, requestKey, t]);

  const currentResult = result?.periodDays === periodDays ? result : null;
  const loading = requestState?.key !== requestKey;
  const error = requestState?.key === requestKey ? requestState.error : "";

  if (!currentResult && loading) {
    return <DashboardSkeleton label={t("admin.dashboard.loading")} />;
  }

  if (!currentResult) {
    return (
      <div className="rounded-xl border border-line bg-surface-card/70 p-5 backdrop-blur-xl sm:p-6">
        <p className={alertErrorClass}>{error}</p>
        <button
          type="button"
          onClick={() => setRefreshKey((key) => key + 1)}
          className={`${secondaryButtonClass} mt-4`}
        >
          <ArrowClockwiseIcon /> {t("common.retry")}
        </button>
      </div>
    );
  }

  const { stats, loadedAt } = currentResult;
  const managedRecords =
    stats.totalUsers + stats.totalTournaments + stats.totalMatches;

  return (
    <div className="min-w-0">
      <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
        <div className="max-w-3xl">
          <p className="inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.18em] text-brand-hover">
            <ShieldCheckIcon size={15} weight="fill" />
            {t("admin.dashboard.eyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-black uppercase leading-none text-ink sm:text-4xl">
            {t("admin.dashboard.title")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-ink-muted">
            {t("admin.dashboard.description")}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setRefreshKey((key) => key + 1)}
            disabled={loading}
            aria-label={t("admin.dashboard.refresh")}
            className="grid size-11 shrink-0 place-items-center rounded-lg bg-brand-secondary text-on-brand transition hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            <ArrowClockwiseIcon
              size={19}
              weight="bold"
              className={loading ? "animate-spin" : ""}
            />
          </button>
        </div>
      </header>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface-card/55 px-4 py-3 text-xs text-ink-faint backdrop-blur-xl">
        <span className="inline-flex items-center gap-2 font-bold uppercase tracking-wide text-approved">
          <span className="size-1.5 rounded-full bg-approved shadow-[0_0_10px_currentColor]" />
          {t("admin.shell.systemOnline")}
        </span>
        <span>
          {formatAdminNumber(managedRecords, locale)}{" "}
          {t("admin.dashboard.managedRecords")} · {t("admin.dashboard.updated")}{" "}
          {loadedAt.toLocaleTimeString(localeTag(locale), {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>

      {error && (
        <p className={`${alertErrorClass} mt-4`}>
          {t("admin.dashboard.stalePrefix")} {error}
        </p>
      )}

      <div className="mt-5">
        <AdminDashboardKpis stats={stats} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <GrowthTrendChart
          stats={stats}
          periodDays={periodDays}
          onPeriodChange={setPeriodDays}
        />
        <AttentionQueue stats={stats} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <TournamentStatusDistribution stats={stats} />
        <PopularGamesChart stats={stats} />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <RecentReports stats={stats} />
        <RecentTournaments stats={stats} />
      </div>
    </div>
  );
}
