"use client";

import Link from "next/link";
import {
  ArrowUpRightIcon,
  EyeSlashIcon,
  FlagIcon,
  LockKeyIcon,
  ShieldWarningIcon,
} from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { formatAdminDate, formatAdminNumber } from "@/features/admin/format";
import type { AdminDashboardStats } from "@/features/admin/types";
import { useLocale, type TranslationKey } from "@/features/locale/store";

function Panel({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-xl border border-line bg-surface-card/70 p-5 shadow-[var(--shadow-elevated)] backdrop-blur-xl sm:p-6 ${className}`}
    >
      {children}
    </section>
  );
}

function PanelHeading({
  eyebrow,
  title,
  href,
}: {
  eyebrow: string;
  title: string;
  href?: string;
}) {
  const { t } = useLocale();
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-hover">
          {eyebrow}
        </p>
        <h2 className="mt-1 text-lg font-black text-ink">{title}</h2>
      </div>
      {href && (
        <Link
          href={href}
          className="inline-flex shrink-0 items-center gap-1 text-xs font-bold text-brand-secondary hover:text-brand"
        >
          {t("admin.dashboard.viewAll")} <ArrowUpRightIcon size={13} />
        </Link>
      )}
    </div>
  );
}

function AttentionRow({
  href,
  label,
  value,
  icon: Icon,
  tone,
}: {
  href: string;
  label: string;
  value: number;
  icon: typeof FlagIcon;
  tone: "warning" | "danger";
}) {
  const { locale } = useLocale();
  const colors =
    tone === "warning"
      ? "bg-pending/10 text-pending"
      : "bg-rejected/10 text-rejected";
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-line bg-surface-sub/50 px-3 py-3 transition hover:border-line-strong hover:bg-surface-hover"
    >
      <span
        className={`grid size-9 shrink-0 place-items-center rounded-lg ${colors}`}
      >
        <Icon size={17} weight="duotone" />
      </span>
      <span className="min-w-0 flex-1 text-xs font-semibold text-ink-muted group-hover:text-ink">
        {label}
      </span>
      <span className={`font-mono text-lg font-black ${colors.split(" ")[1]}`}>
        {formatAdminNumber(value, locale)}
      </span>
      <ArrowUpRightIcon size={13} className="text-ink-faint" />
    </Link>
  );
}

export function AttentionQueue({ stats }: { stats: AdminDashboardStats }) {
  const { t } = useLocale();
  return (
    <Panel>
      <PanelHeading
        eyebrow={t("admin.dashboard.requiresAttention")}
        title={t("admin.dashboard.attentionQueue")}
      />
      <div className="mt-5 space-y-2.5">
        <AttentionRow
          href="/admin/reports"
          label={t("admin.dashboard.pendingReportCount")}
          value={stats.pendingReports}
          icon={FlagIcon}
          tone="warning"
        />
        <AttentionRow
          href="/admin/reports"
          label={t("admin.dashboard.reportedTournamentCount")}
          value={stats.tournamentsWithPendingReports}
          icon={ShieldWarningIcon}
          tone="warning"
        />
        <AttentionRow
          href="/admin/tournaments"
          label={t("admin.dashboard.hiddenByAdmin")}
          value={stats.hiddenTournaments}
          icon={EyeSlashIcon}
          tone="danger"
        />
        <AttentionRow
          href="/admin/users"
          label={t("admin.dashboard.lockedAccountsRow")}
          value={stats.lockedAccounts}
          icon={LockKeyIcon}
          tone="danger"
        />
      </div>
    </Panel>
  );
}

export function RecentReports({ stats }: { stats: AdminDashboardStats }) {
  const { locale, t } = useLocale();
  return (
    <Panel>
      <PanelHeading
        eyebrow={t("admin.dashboard.recentActivity")}
        title={t("admin.dashboard.recentReports")}
        href="/admin/reports"
      />
      {stats.recentReports.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-ink-faint">
          {t("admin.dashboard.noRecentReports")}
        </p>
      ) : (
        <div className="mt-4 divide-y divide-line">
          {stats.recentReports.map((report) => (
            <Link
              href="/admin/reports"
              key={report.id}
              className="group grid gap-2 py-3.5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-2">
                  <span
                    className={`size-2 shrink-0 rounded-full ${
                      report.status === "PENDING"
                        ? "bg-pending"
                        : report.status === "REVIEWED"
                          ? "bg-approved"
                          : "bg-ink-faint"
                    }`}
                  />
                  <span className="truncate text-sm font-bold text-ink group-hover:text-brand-secondary">
                    {t(
                      `admin.report.reason.${report.reason}` as TranslationKey,
                    )}
                  </span>
                </span>
                <span className="mt-1 block truncate pl-4 text-xs text-ink-muted">
                  {report.tournament.name} ·{" "}
                  {report.reporter?.displayName ?? t("admin.reports.guest")}
                </span>
              </span>
              <span className="pl-4 text-xs text-ink-faint sm:pl-0 sm:text-right">
                <span className="block font-semibold text-ink-muted">
                  {t(`admin.report.status.${report.status}` as TranslationKey)}
                </span>
                {formatAdminDate(report.createdAt, locale, true)}
              </span>
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}

export function RecentTournaments({ stats }: { stats: AdminDashboardStats }) {
  const { locale, t } = useLocale();
  return (
    <Panel>
      <PanelHeading
        eyebrow={t("admin.dashboard.recentActivity")}
        title={t("admin.dashboard.recentTournaments")}
        href="/admin/tournaments"
      />
      {stats.recentTournaments.length === 0 ? (
        <p className="mt-5 rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-ink-faint">
          {t("admin.dashboard.noRecentTournaments")}
        </p>
      ) : (
        <div className="mt-4 divide-y divide-line">
          {stats.recentTournaments.map((tournament) => (
            <Link
              key={tournament.id}
              href={`/tournaments/${tournament.slug}`}
              className="group flex min-w-0 items-center gap-3 py-3"
            >
              <span className="h-12 w-20 shrink-0 overflow-hidden rounded-lg bg-surface-sub">
                <ResolvedImage
                  src={tournament.bannerUrl}
                  alt=""
                  className="size-full object-cover"
                  fallback={
                    <span className="grid size-full place-items-center font-mono font-black text-brand">
                      {tournament.name.charAt(0).toUpperCase()}
                    </span>
                  }
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="truncate text-sm font-bold text-ink group-hover:text-brand-secondary">
                    {tournament.name}
                  </span>
                  {tournament.isOfficial && (
                    <span className="shrink-0 rounded-full bg-brand/12 px-2 py-0.5 text-[9px] font-black uppercase text-brand">
                      Official
                    </span>
                  )}
                </span>
                <span className="mt-1 block truncate text-xs text-ink-muted">
                  {tournament.displayGameName} ·{" "}
                  {tournament.organizer.displayName}
                </span>
                <span className="mt-1 block text-[10px] font-bold text-ink-faint sm:hidden">
                  {t(
                    `tournaments.discovery.${tournament.status.toLowerCase()}` as TranslationKey,
                  )}{" "}
                  · {formatAdminDate(tournament.createdAt, locale)}
                </span>
              </span>
              <span className="hidden shrink-0 text-right text-[10px] text-ink-faint sm:block">
                <span className="block font-bold text-ink-muted">
                  {t(
                    `tournaments.discovery.${tournament.status.toLowerCase()}` as TranslationKey,
                  )}
                </span>
                {formatAdminDate(tournament.createdAt, locale)}
              </span>
              <ArrowUpRightIcon size={13} className="shrink-0 text-ink-faint" />
            </Link>
          ))}
        </div>
      )}
    </Panel>
  );
}
