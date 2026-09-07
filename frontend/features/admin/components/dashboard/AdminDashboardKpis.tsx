"use client";

import Link from "next/link";
import {
  ArrowDownRightIcon,
  ArrowUpRightIcon,
  FlagIcon,
  GameControllerIcon,
  TrophyIcon,
  UsersThreeIcon,
} from "@phosphor-icons/react";
import BorderGlow from "@/components/effects/BorderGlow";
import { formatAdminNumber } from "@/features/admin/format";
import type { AdminDashboardStats } from "@/features/admin/types";
import { localeTag } from "@/features/locale/format";
import { useLocale } from "@/features/locale/store";

function GrowthBadge({ value }: { value: number | null }) {
  const { locale, t } = useLocale();
  if (value === null) {
    return (
      <span className="rounded-full bg-surface-sub px-2 py-1 text-[10px] font-bold text-ink-faint">
        {t("admin.dashboard.noPreviousData")}
      </span>
    );
  }

  const positive = value >= 0;
  const Icon = positive ? ArrowUpRightIcon : ArrowDownRightIcon;
  return (
    <span
      title={t("admin.dashboard.comparedPreviousPeriod")}
      className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-black ${
        positive
          ? "bg-approved/12 text-approved"
          : "bg-rejected/12 text-rejected"
      }`}
    >
      <Icon size={11} weight="bold" />
      {Math.abs(value).toLocaleString(localeTag(locale), {
        maximumFractionDigits: 1,
      })}
      %
    </span>
  );
}

function KpiShell({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="group block min-w-0">
      <BorderGlow
        edgeSensitivity={30}
        glowColor="275 86 70"
        backgroundColor="color-mix(in oklab, var(--color-surface-card) 72%, transparent)"
        borderRadius={12}
        glowRadius={36}
        glowIntensity={0.8}
        coneSpread={24}
        colors={["#8b5cf6", "#ec4899", "#38bdf8"]}
        className="h-full transition-transform duration-200 group-hover:-translate-y-0.5"
      >
        <article className="relative min-h-44 overflow-hidden p-5">
          {children}
          <ArrowUpRightIcon
            className="absolute bottom-5 right-5 text-ink-faint transition group-hover:text-brand-secondary"
            size={15}
          />
        </article>
      </BorderGlow>
    </Link>
  );
}

function CardHeading({
  label,
  icon: Icon,
  tone,
}: {
  label: string;
  icon: typeof UsersThreeIcon;
  tone: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <p className="text-xs font-black uppercase tracking-[0.13em] text-ink-muted">
        {label}
      </p>
      <span
        className={`grid size-10 shrink-0 place-items-center rounded-xl border ${tone}`}
      >
        <Icon size={20} weight="duotone" />
      </span>
    </div>
  );
}

export default function AdminDashboardKpis({
  stats,
}: {
  stats: AdminDashboardStats;
}) {
  const { locale, t } = useLocale();
  const periodText = `${stats.periodDays} ${t("admin.dashboard.days")}`;

  return (
    <section
      aria-labelledby="admin-dashboard-kpis"
      className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4"
    >
      <h2 id="admin-dashboard-kpis" className="sr-only">
        {t("admin.dashboard.metrics")}
      </h2>

      <KpiShell href="/admin/users">
        <CardHeading
          label={t("admin.dashboard.totalUsers")}
          icon={UsersThreeIcon}
          tone="border-brand/25 bg-brand/10 text-brand"
        />
        <p className="mt-2 font-mono text-4xl font-black tracking-tight text-ink">
          {formatAdminNumber(stats.totalUsers, locale)}
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-ink-muted">
          <span>
            <strong className="font-mono text-ink">
              +{formatAdminNumber(stats.newUsers, locale)}
            </strong>{" "}
            {t("admin.dashboard.inLastPeriod")} {periodText}
          </span>
          <GrowthBadge value={stats.userGrowthPercent} />
        </div>
      </KpiShell>

      <KpiShell href="/admin/tournaments">
        <CardHeading
          label={t("admin.dashboard.totalTournaments")}
          icon={TrophyIcon}
          tone="border-brand-secondary/25 bg-brand-secondary/10 text-brand-secondary"
        />
        <p className="mt-2 font-mono text-4xl font-black tracking-tight text-ink">
          {formatAdminNumber(stats.totalTournaments, locale)}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 pr-6">
          <div className="rounded-lg bg-surface-sub/65 px-3 py-2">
            <p className="font-mono text-lg font-black text-brand-secondary">
              {formatAdminNumber(stats.ongoingTournaments, locale)}
            </p>
            <p className="text-[10px] font-semibold text-ink-faint">
              {t("admin.dashboard.ongoing")}
            </p>
          </div>
          <div className="rounded-lg bg-surface-sub/65 px-3 py-2">
            <p className="font-mono text-lg font-black text-brand">
              {formatAdminNumber(stats.officialTournaments, locale)}
            </p>
            <p className="text-[10px] font-semibold text-ink-faint">
              {t("admin.dashboard.official")}
            </p>
          </div>
        </div>
      </KpiShell>

      <KpiShell href="/admin/tournaments">
        <CardHeading
          label={t("admin.dashboard.totalMatches")}
          icon={GameControllerIcon}
          tone="border-brand/25 bg-brand/10 text-brand"
        />
        <p className="mt-2 font-mono text-4xl font-black tracking-tight text-ink">
          {formatAdminNumber(stats.totalMatches, locale)}
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-surface-sub/65 px-3 py-2 text-xs text-ink-muted">
          <strong className="font-mono text-lg text-brand">
            {formatAdminNumber(stats.matchesToday, locale)}
          </strong>
          {t("admin.dashboard.matchesToday")}
        </div>
      </KpiShell>

      <KpiShell href="/admin/reports">
        <CardHeading
          label={t("admin.dashboard.pendingReportCount")}
          icon={FlagIcon}
          tone="border-pending/25 bg-pending/10 text-pending"
        />
        <p className="mt-2 font-mono text-4xl font-black tracking-tight text-pending">
          {formatAdminNumber(stats.pendingReports, locale)}
        </p>
        <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-pending/8 px-3 py-2 text-xs text-ink-muted">
          <strong className="font-mono text-lg text-pending">
            {formatAdminNumber(stats.tournamentsWithPendingReports, locale)}
          </strong>
          {t("admin.dashboard.affectedTournaments")}
        </div>
      </KpiShell>
    </section>
  );
}
