"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import {
  ArrowClockwiseIcon,
  ArrowUpRightIcon,
  CalendarPlusIcon,
  FlagIcon,
  GavelIcon,
  LockKeyIcon,
  ShieldCheckIcon,
  ShieldWarningIcon,
  TrophyIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import { adminApi } from "@/features/admin/api";
import type { AdminDashboardStats } from "@/features/admin/types";
import BorderGlow from "@/components/effects/BorderGlow";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import { formatAdminNumber } from "@/features/admin/format";
import { localeTag } from "@/features/locale/format";
import { useLocale } from "@/features/locale/store";
import type { Locale } from "@/features/locale/types";

type DashboardIcon = ComponentType<{
  size?: number;
  weight?: "duotone" | "fill" | "regular";
  className?: string;
}>;

interface MetricCardProps {
  label: string;
  value: number;
  helper: string;
  locale: Locale;
  icon: DashboardIcon;
  href: string;
  tone?: "brand" | "secondary" | "warning" | "danger";
}

const metricTone = {
  brand: {
    icon: "border-brand/25 bg-brand/10 text-brand",
    glow: "bg-brand",
    line: "from-brand to-brand/0",
  },
  secondary: {
    icon: "border-brand-secondary/25 bg-brand-secondary/10 text-brand-secondary",
    glow: "bg-brand-secondary",
    line: "from-brand-secondary to-brand-secondary/0",
  },
  warning: {
    icon: "border-pending/25 bg-pending/10 text-pending",
    glow: "bg-pending",
    line: "from-pending to-pending/0",
  },
  danger: {
    icon: "border-rejected/25 bg-rejected/10 text-rejected",
    glow: "bg-rejected",
    line: "from-rejected to-rejected/0",
  },
} as const;

function MetricCard({
  label,
  value,
  helper,
  locale,
  icon: Icon,
  href,
  tone = "brand",
}: MetricCardProps) {
  const colors = metricTone[tone];

  return (
    <Link href={href} className="group block h-full min-w-0">
      <BorderGlow
        edgeSensitivity={30}
        glowColor="40 80 80"
        backgroundColor="color-mix(in oklab, var(--color-surface-card) 72%, transparent)"
        borderRadius={10}
        glowRadius={40}
        glowIntensity={1}
        coneSpread={25}
        animated={false}
        colors={["#c084fc", "#f472b6", "#38bdf8"]}
        className="h-full transition-transform duration-200 group-hover:-translate-y-0.5"
      >
        <article className="admin-metric-card relative min-h-36 w-full overflow-hidden p-4 sm:p-5">
          <span
            aria-hidden
            className={`absolute -right-8 -top-8 size-24 rounded-full opacity-[0.08] blur-2xl ${colors.glow}`}
          />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-xs font-bold uppercase tracking-[0.12em] text-ink-muted">
                {label}
              </p>
              <p className="mt-3 font-mono text-3xl font-black tracking-tight text-ink sm:text-[2rem]">
                {formatAdminNumber(value, locale)}
              </p>
            </div>
            <span
              className={`grid size-10 shrink-0 place-items-center rounded-xl border ${colors.icon}`}
            >
              <Icon size={20} weight="duotone" />
            </span>
          </div>
          <div className="relative mt-4 flex items-end justify-between gap-3">
            <p className="line-clamp-2 text-xs leading-5 text-ink-faint">
              {helper}
            </p>
            <ArrowUpRightIcon
              size={15}
              className="shrink-0 text-ink-faint transition group-hover:text-brand-secondary"
            />
          </div>
          <span
            aria-hidden
            className={`absolute inset-x-4 bottom-0 h-px bg-gradient-to-r ${colors.line}`}
          />
        </article>
      </BorderGlow>
    </Link>
  );
}

function DashboardSkeleton({ label }: { label: string }) {
  return (
    <div aria-label={label} className="space-y-4">
      <div className="h-28 animate-pulse rounded-lg border border-line bg-surface-card" />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={index}
            className="h-36 animate-pulse rounded-lg border border-line bg-surface-card"
          />
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const { locale, t } = useLocale();
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
          setError(
            reason instanceof Error
              ? reason.message
              : t("admin.dashboard.loadError"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setRefreshing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey, t]);

  const refresh = () => {
    if (refreshing) return;
    setRefreshing(true);
    setError("");
    setRefreshKey((key) => key + 1);
  };

  if (!result && !error) {
    return <DashboardSkeleton label={t("admin.dashboard.loading")} />;
  }

  if (!result) {
    return (
      <div className="rounded-lg border border-line bg-surface-card p-5 sm:p-6">
        <p className={alertErrorClass}>{error}</p>
        <button
          type="button"
          onClick={refresh}
          disabled={refreshing}
          className={`${secondaryButtonClass} mt-4`}
        >
          <ArrowClockwiseIcon /> {t("common.retry")}
        </button>
      </div>
    );
  }

  const { stats, loadedAt } = result;
  const activeAccounts = Math.max(stats.totalUsers - stats.lockedAccounts, 0);
  const visibleTournaments = Math.max(
    stats.totalTournaments - stats.lockedTournaments,
    0,
  );
  const quickLinks = [
    {
      href: "/admin/tournaments",
      label: t("admin.nav.tournaments"),
      icon: TrophyIcon,
    },
    {
      href: "/admin/users",
      label: t("admin.nav.users"),
      icon: UsersThreeIcon,
    },
    {
      href: "/admin/reports",
      label: t("admin.nav.reports"),
      icon: FlagIcon,
    },
    {
      href: "/admin/moderation",
      label: t("admin.nav.moderation"),
      icon: GavelIcon,
    },
  ];

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

        <div className="flex w-full max-w-md items-center gap-4 rounded-lg border border-line bg-surface-card/70 p-3 shadow-[var(--shadow-elevated)] backdrop-blur-xl lg:w-auto">
          <div className="min-w-0 flex-1 lg:min-w-44">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-approved">
              <span className="size-1.5 rounded-full bg-approved shadow-[0_0_10px_currentColor]" />
              {t("admin.shell.systemOnline")}
            </span>
            <p className="mt-1 truncate text-xs text-ink-faint">
              {formatAdminNumber(
                stats.totalUsers + stats.totalTournaments,
                locale,
              )}{" "}
              {t("admin.dashboard.managedRecords")} ·{" "}
              {t("admin.dashboard.updated")}{" "}
              {loadedAt.toLocaleTimeString(localeTag(locale), {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            aria-label={t("admin.dashboard.refresh")}
            className="grid size-11 shrink-0 place-items-center rounded-md bg-brand-secondary text-on-brand transition hover:brightness-110 active:scale-95 disabled:opacity-50"
          >
            <ArrowClockwiseIcon
              size={19}
              weight="bold"
              className={refreshing ? "animate-spin" : ""}
            />
          </button>
        </div>
      </header>

      <nav
        aria-label={t("admin.dashboard.quickAccess")}
        className="mt-5 grid overflow-hidden rounded-lg border border-line bg-surface-card/70 shadow-[var(--shadow-elevated)] backdrop-blur-xl sm:grid-cols-2 xl:grid-cols-4"
      >
        {quickLinks.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex min-h-12 items-center justify-between gap-3 border-b border-line px-4 py-3 text-xs font-black uppercase tracking-[0.08em] text-ink-muted transition hover:bg-brand-secondary/10 hover:text-ink sm:[&:nth-child(odd)]:border-r xl:border-b-0 xl:border-r xl:last:border-r-0"
          >
            <span className="flex items-center gap-2.5">
              <Icon
                size={17}
                className="text-ink-faint transition group-hover:text-brand-secondary"
              />
              {label}
            </span>
            <ArrowUpRightIcon className="text-ink-faint" size={14} />
          </Link>
        ))}
      </nav>

      {error && (
        <p className={`${alertErrorClass} mt-4`}>
          {t("admin.dashboard.stalePrefix")} {error}
        </p>
      )}

      <section aria-labelledby="platform-metrics" className="mt-5">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-hover">
              {t("admin.dashboard.liveData")}
            </p>
            <h2
              id="platform-metrics"
              className="mt-1 text-lg font-black text-ink"
            >
              {t("admin.dashboard.metrics")}
            </h2>
          </div>
          <span className="font-mono text-[11px] uppercase text-ink-faint">
            {t("admin.dashboard.updated")}{" "}
            {loadedAt.toLocaleTimeString(localeTag(locale), {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <MetricCard
            locale={locale}
            label={t("admin.dashboard.users")}
            value={stats.totalUsers}
            helper={t("admin.dashboard.usersHelp")}
            icon={UsersThreeIcon}
            href="/admin/users"
          />
          <MetricCard
            locale={locale}
            label={t("admin.dashboard.tournaments")}
            value={stats.totalTournaments}
            helper={t("admin.dashboard.tournamentsHelp")}
            icon={TrophyIcon}
            href="/admin/tournaments"
            tone="secondary"
          />
          <MetricCard
            locale={locale}
            label={t("admin.dashboard.newTournaments")}
            value={stats.tournamentsCreatedLast7Days}
            helper={t("admin.dashboard.newTournamentsHelp")}
            icon={CalendarPlusIcon}
            href="/admin/tournaments"
          />
          <MetricCard
            locale={locale}
            label={t("admin.dashboard.reportedTournaments")}
            value={stats.tournamentsBeingReported}
            helper={t("admin.dashboard.reportedTournamentsHelp")}
            icon={FlagIcon}
            href="/admin/reports"
            tone="warning"
          />
          <MetricCard
            locale={locale}
            label={t("admin.dashboard.hiddenTournaments")}
            value={stats.lockedTournaments}
            helper={t("admin.dashboard.hiddenTournamentsHelp")}
            icon={ShieldWarningIcon}
            href="/admin/tournaments"
            tone="danger"
          />
          <MetricCard
            locale={locale}
            label={t("admin.dashboard.lockedAccounts")}
            value={stats.lockedAccounts}
            helper={t("admin.dashboard.lockedAccountsHelp")}
            icon={LockKeyIcon}
            href="/admin/users"
            tone="danger"
          />
        </div>
      </section>

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(18rem,0.65fr)]">
        <section className="rounded-lg border border-line bg-surface-card/70 p-5 shadow-[var(--shadow-elevated)] backdrop-blur-xl sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-hover">
                {t("admin.dashboard.currentRatios")}
              </p>
              <h2 className="mt-1 font-black text-ink">
                {t("admin.dashboard.platformHealth")}
              </h2>
            </div>
            <ShieldCheckIcon size={24} className="text-brand" />
          </div>
          <div className="mt-6 space-y-5">
            <ProgressRow
              label={t("admin.dashboard.activeAccounts")}
              value={activeAccounts}
              total={stats.totalUsers}
              locale={locale}
              tone="brand"
            />
            <ProgressRow
              label={t("admin.dashboard.visibleTournaments")}
              value={visibleTournaments}
              total={stats.totalTournaments}
              locale={locale}
              tone="secondary"
            />
            <ProgressRow
              label={t("admin.dashboard.createdLast7Days")}
              value={stats.tournamentsCreatedLast7Days}
              total={stats.totalTournaments}
              locale={locale}
              tone="warning"
            />
          </div>
        </section>

        <section className="rounded-lg border border-line bg-surface-card/70 p-5 shadow-[var(--shadow-elevated)] backdrop-blur-xl sm:p-6">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-secondary">
            {t("admin.dashboard.requiresAttention")}
          </p>
          <h2 className="mt-1 font-black text-ink">
            {t("admin.dashboard.attentionQueue")}
          </h2>
          <div className="mt-4 space-y-2">
            <AttentionLink
              href="/admin/reports"
              label={t("admin.dashboard.pendingReports")}
              value={stats.tournamentsBeingReported}
              locale={locale}
              icon={FlagIcon}
              tone="warning"
            />
            <AttentionLink
              href="/admin/tournaments"
              label={t("admin.dashboard.hiddenByAdmin")}
              value={stats.lockedTournaments}
              locale={locale}
              icon={ShieldWarningIcon}
              tone="danger"
            />
            <AttentionLink
              href="/admin/users"
              label={t("admin.dashboard.lockedAccountsRow")}
              value={stats.lockedAccounts}
              locale={locale}
              icon={LockKeyIcon}
              tone="danger"
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function ProgressRow({
  label,
  value,
  total,
  locale,
  tone,
}: {
  label: string;
  value: number;
  total: number;
  locale: Locale;
  tone: "brand" | "secondary" | "warning";
}) {
  const percentage = total > 0 ? Math.min((value / total) * 100, 100) : 0;
  const barClass = {
    brand: "from-brand to-brand-hover",
    secondary: "from-brand-secondary to-brand",
    warning: "from-pending to-brand-secondary",
  }[tone];

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-xs">
        <span className="font-semibold text-ink-muted">{label}</span>
        <span className="font-mono font-bold text-ink">
          {formatAdminNumber(value, locale)} /{" "}
          {formatAdminNumber(total, locale)}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-surface-sub">
        <div
          className={`h-full rounded-full bg-gradient-to-r ${barClass} shadow-[0_0_14px_currentColor]`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

function AttentionLink({
  href,
  label,
  value,
  locale,
  icon: Icon,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  locale: Locale;
  icon: DashboardIcon;
  tone: "warning" | "danger";
}) {
  const color = {
    warning: "text-pending",
    danger: "text-rejected",
  }[tone];
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-line bg-surface-sub/65 px-3 py-3 transition hover:border-line-strong hover:bg-surface-hover"
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-lg bg-current/10 ${color}`}
      >
        <Icon size={17} weight="duotone" />
      </span>
      <span className="min-w-0 flex-1 truncate text-xs font-semibold text-ink-muted group-hover:text-ink">
        {label}
      </span>
      <span className={`font-mono text-lg font-black ${color}`}>
        {formatAdminNumber(value, locale)}
      </span>
      <ArrowUpRightIcon size={14} className="text-ink-faint" />
    </Link>
  );
}
