"use client";

import {
  CalendarBlankIcon,
  ChartLineUpIcon,
  CheckCircleIcon,
  FileTextIcon,
  GameControllerIcon,
  PlayIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { formatAdminNumber } from "@/features/admin/format";
import type {
  AdminDailyGrowthPoint,
  AdminDashboardPeriod,
  AdminDashboardStats,
} from "@/features/admin/types";
import { localeTag } from "@/features/locale/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { getTournamentBannerUrl } from "@/features/tournaments/banner";
import type { TournamentStatus } from "@/shared/types/tournament-status";

const STATUS_STYLES: Record<
  TournamentStatus,
  {
    bar: string;
    dot: string;
    label: TranslationKey;
    icon: typeof FileTextIcon;
  }
> = {
  DRAFT: {
    bar: "bg-ink-faint",
    dot: "bg-ink-faint",
    label: "tournaments.discovery.draft",
    icon: FileTextIcon,
  },
  REGISTRATION: {
    bar: "bg-brand",
    dot: "bg-brand",
    label: "tournaments.discovery.registration",
    icon: CalendarBlankIcon,
  },
  ONGOING: {
    bar: "bg-brand-secondary",
    dot: "bg-brand-secondary",
    label: "tournaments.discovery.ongoing",
    icon: PlayIcon,
  },
  COMPLETED: {
    bar: "bg-approved",
    dot: "bg-approved",
    label: "tournaments.discovery.completed",
    icon: CheckCircleIcon,
  },
  CANCELLED: {
    bar: "bg-rejected",
    dot: "bg-rejected",
    label: "tournaments.discovery.cancelled",
    icon: XCircleIcon,
  },
};

const POPULAR_GAME_COLORS = [
  "var(--color-brand-secondary)",
  "var(--color-brand)",
  "var(--color-accent)",
  "var(--color-approved)",
  "var(--color-pending)",
] as const;

function createDonutGradient(
  slices: Array<{ count: number; color: string }>,
  total: number,
) {
  let offset = 0;
  const stops = slices.map((slice) => {
    const start = offset;
    offset += (slice.count / total) * 100;
    return `${slice.color} ${start}% ${offset}%`;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

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

function pointsFor(
  data: AdminDailyGrowthPoint[],
  key: "newUsers" | "newTournaments",
  maxValue: number,
) {
  const left = 28;
  const right = 692;
  const top = 20;
  const bottom = 180;
  return data.map((point, index) => ({
    x:
      data.length <= 1
        ? left
        : left + (index / (data.length - 1)) * (right - left),
    y: bottom - (point[key] / maxValue) * (bottom - top),
    value: point[key],
    date: point.date,
  }));
}

function linePath(points: Array<{ x: number; y: number }>) {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

export function GrowthTrendChart({
  stats,
  periodDays,
  onPeriodChange,
}: {
  stats: AdminDashboardStats;
  periodDays: AdminDashboardPeriod;
  onPeriodChange: (period: AdminDashboardPeriod) => void;
}) {
  const { locale, t } = useLocale();
  const maxValue = Math.max(
    1,
    ...stats.dailyGrowth.flatMap((point) => [
      point.newUsers,
      point.newTournaments,
    ]),
  );
  const userPoints = pointsFor(stats.dailyGrowth, "newUsers", maxValue);
  const tournamentPoints = pointsFor(
    stats.dailyGrowth,
    "newTournaments",
    maxValue,
  );
  const labelEvery = stats.periodDays === 7 ? 1 : 5;

  return (
    <Panel className="min-w-0 xl:col-span-2">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-hover">
            {t("admin.dashboard.growthEyebrow")}
          </p>
          <h2 className="mt-1 text-lg font-black text-ink">
            {t("admin.dashboard.growthTitle")}
          </h2>
        </div>
        <div className="flex items-end gap-3">
          <ChartLineUpIcon
            size={24}
            className="mb-2 text-brand"
            weight="duotone"
          />
          <div>
            <p className="mb-1.5 text-right text-[10px] font-bold uppercase tracking-wide text-ink-faint">
              {t("admin.dashboard.periodAria")}
            </p>
            <div
              role="group"
              aria-label={t("admin.dashboard.periodAria")}
              className="inline-flex rounded-lg border border-line bg-surface-sub/70 p-1"
            >
              {([7, 30] as const).map((period) => (
                <button
                  key={period}
                  type="button"
                  aria-pressed={periodDays === period}
                  onClick={() => onPeriodChange(period)}
                  className={`min-h-8 rounded-md px-3 text-[11px] font-black transition ${
                    periodDays === period
                      ? "bg-brand-secondary text-on-brand shadow-md shadow-brand-secondary/20"
                      : "text-ink-muted hover:bg-surface-hover hover:text-ink"
                  }`}
                >
                  {period}D
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
        <div>
          <p className="text-xs text-ink-faint">
            {t("admin.dashboard.newUsers")}
          </p>
          <p className="mt-1 font-mono text-2xl font-black text-ink">
            {formatAdminNumber(stats.newUsers, locale)}
          </p>
        </div>
        <div>
          <p className="text-xs text-ink-faint">
            {t("admin.dashboard.newTournamentsPeriod")}
          </p>
          <p className="mt-1 font-mono text-2xl font-black text-ink">
            {formatAdminNumber(stats.newTournaments, locale)}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-4 self-end text-[11px] font-semibold text-ink-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-brand" />
            {t("admin.dashboard.usersSeries")}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-brand-secondary" />
            {t("admin.dashboard.tournamentsSeries")}
          </span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto rounded-lg border border-line bg-surface-sub/35 px-2 pb-2 pt-3">
        <svg
          viewBox="0 0 720 210"
          role="img"
          aria-label={t("admin.dashboard.growthChartAria")}
          className="h-auto min-w-[42rem] w-full"
        >
          <defs>
            <linearGradient id="admin-user-area" x1="0" y1="0" x2="0" y2="1">
              <stop
                offset="0"
                stopColor="var(--color-brand)"
                stopOpacity="0.22"
              />
              <stop offset="1" stopColor="var(--color-brand)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[20, 60, 100, 140, 180].map((y) => (
            <line
              key={y}
              x1="28"
              x2="692"
              y1={y}
              y2={y}
              stroke="var(--color-line)"
              strokeDasharray="4 7"
              opacity="0.75"
            />
          ))}
          {userPoints.length > 0 && (
            <polygon
              points={`28,180 ${linePath(userPoints)} 692,180`}
              fill="url(#admin-user-area)"
            />
          )}
          <polyline
            points={linePath(userPoints)}
            fill="none"
            stroke="var(--color-brand)"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          <polyline
            points={linePath(tournamentPoints)}
            fill="none"
            stroke="var(--color-brand-secondary)"
            strokeWidth="3"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
          {userPoints.map((point, index) => (
            <g key={`user-${point.date}`}>
              <circle cx={point.x} cy={point.y} r="4" fill="var(--color-brand)">
                <title>{`${point.date}: ${point.value} ${t("admin.dashboard.usersSeries")}`}</title>
              </circle>
              {(index % labelEvery === 0 ||
                index === userPoints.length - 1) && (
                <text
                  x={point.x}
                  y="202"
                  textAnchor="middle"
                  fill="var(--color-ink-faint)"
                  fontSize="10"
                >
                  {new Date(`${point.date}T00:00:00+07:00`).toLocaleDateString(
                    localeTag(locale),
                    { day: "2-digit", month: "2-digit" },
                  )}
                </text>
              )}
            </g>
          ))}
          {tournamentPoints.map((point) => (
            <circle
              key={`tournament-${point.date}`}
              cx={point.x}
              cy={point.y}
              r="3.5"
              fill="var(--color-brand-secondary)"
            >
              <title>{`${point.date}: ${point.value} ${t("admin.dashboard.tournamentsSeries")}`}</title>
            </circle>
          ))}
        </svg>
      </div>
    </Panel>
  );
}

export function TournamentStatusDistribution({
  stats,
}: {
  stats: AdminDashboardStats;
}) {
  const { locale, t } = useLocale();
  const total = Math.max(
    stats.tournamentStatusDistribution.reduce(
      (sum, item) => sum + item.count,
      0,
    ),
    0,
  );
  const populatedStatuses = stats.tournamentStatusDistribution.filter(
    (item) => item.count > 0,
  ).length;

  return (
    <Panel>
      <h2 className="text-sm font-bold text-ink">
        {t("admin.dashboard.statusDistribution")}
      </h2>
      <div className="mt-2 flex flex-wrap items-end gap-3">
        <p className="font-mono text-3xl font-black tracking-tight text-ink">
          {formatAdminNumber(total, locale)}
        </p>
        <p className="mb-1 text-xs font-semibold text-ink-muted">
          {t("admin.dashboard.totalTournaments")}
        </p>
        <span className="mb-1 ml-auto rounded-md bg-brand/15 px-2 py-1 text-[10px] font-black text-brand">
          {populatedStatuses} {t("admin.dashboard.statuses")}
        </span>
      </div>
      <div
        className="mt-6 flex h-3 gap-1 overflow-hidden rounded-sm bg-surface-sub"
        aria-label={t("admin.dashboard.statusDistribution")}
      >
        {stats.tournamentStatusDistribution.map((item) => (
          <span
            key={item.status}
            className={`first:rounded-l-sm last:rounded-r-sm ${STATUS_STYLES[item.status].bar}`}
            style={{ width: total ? `${(item.count / total) * 100}%` : "0%" }}
          />
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        {stats.tournamentStatusDistribution.map((item) => (
          <span
            key={`legend-${item.status}`}
            className="inline-flex items-center gap-2 text-[11px] font-semibold text-ink-muted"
          >
            <span
              className={`size-2 rounded-full ${STATUS_STYLES[item.status].dot}`}
            />
            {t(STATUS_STYLES[item.status].label)}
          </span>
        ))}
      </div>

      <div className="my-5 h-px bg-line" />

      <div className="space-y-3.5">
        {stats.tournamentStatusDistribution.map((item) => {
          const percentage = total ? (item.count / total) * 100 : 0;
          const Icon = STATUS_STYLES[item.status].icon;
          return (
            <div key={item.status} className="flex items-center gap-3 text-xs">
              <Icon size={18} className="shrink-0 text-ink-faint" />
              <span className="min-w-0 flex-1 truncate font-semibold text-ink-muted">
                {t(STATUS_STYLES[item.status].label)}
              </span>
              <span className="min-w-8 text-right font-mono font-black text-ink">
                {formatAdminNumber(item.count, locale)}
              </span>
              <span className="w-12 text-right font-mono text-ink-faint">
                {percentage.toLocaleString(localeTag(locale), {
                  maximumFractionDigits: 1,
                })}
                %
              </span>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

export function PopularGamesChart({ stats }: { stats: AdminDashboardStats }) {
  const { locale, t } = useLocale();
  const rankedGames = stats.topGames.map((game, index) => ({
    ...game,
    color: POPULAR_GAME_COLORS[index % POPULAR_GAME_COLORS.length],
  }));
  const rankedTournamentCount = rankedGames.reduce(
    (sum, game) => sum + game.tournamentCount,
    0,
  );
  const chartTotal = Math.max(stats.totalTournaments, rankedTournamentCount, 1);
  const otherTournamentCount = Math.max(
    chartTotal - rankedTournamentCount,
    0,
  );
  const donutGradient = createDonutGradient(
    [
      ...rankedGames.map((game) => ({
        count: game.tournamentCount,
        color: game.color,
      })),
      ...(otherTournamentCount > 0
        ? [
            {
              count: otherTournamentCount,
              color:
                "color-mix(in oklab, var(--color-ink-faint) 25%, transparent)",
            },
          ]
        : []),
    ],
    chartTotal,
  );

  return (
    <Panel>
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-brand-secondary">
            {t("admin.dashboard.popularity")}
          </p>
          <h2 className="mt-1 text-lg font-black text-ink">
            {t("admin.dashboard.popularGames")}
          </h2>
        </div>
        <GameControllerIcon
          size={24}
          weight="duotone"
          className="text-brand-secondary"
        />
      </div>

      {stats.topGames.length === 0 ? (
        <p className="mt-8 rounded-lg border border-dashed border-line px-4 py-10 text-center text-sm text-ink-faint">
          {t("admin.dashboard.noGameData")}
        </p>
      ) : (
        <div className="mt-6 grid items-center gap-6 sm:grid-cols-[13rem_minmax(0,1fr)]">
          <div
            role="img"
            aria-label={`${t("admin.dashboard.popularGames")}: ${formatAdminNumber(chartTotal, locale)}`}
            className="mx-auto grid size-52 shrink-0 place-items-center rounded-full p-[15px] shadow-[0_16px_48px_color-mix(in_oklab,var(--color-brand)_16%,transparent)]"
            style={{ background: donutGradient }}
          >
            <div className="grid size-full place-items-center rounded-full border border-line bg-surface-card/75 text-center backdrop-blur-xl">
              <span>
                <GameControllerIcon
                  size={22}
                  weight="duotone"
                  className="mx-auto text-brand-secondary"
                />
                <strong className="mt-1 block font-mono text-3xl font-black text-ink">
                  {formatAdminNumber(chartTotal, locale)}
                </strong>
                <span className="mt-0.5 block text-[10px] font-bold uppercase tracking-wide text-ink-faint">
                  {t("admin.dashboard.totalTournaments")}
                </span>
              </span>
            </div>
          </div>

          <ul className="min-w-0 space-y-2">
            {rankedGames.map((game, index) => (
              <li
                key={game.gameId}
                className="grid grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 rounded-lg border border-line bg-surface-sub/35 p-2"
              >
                <span className="h-9 w-12 overflow-hidden rounded-md bg-surface-sub">
                  <ResolvedImage
                    src={getTournamentBannerUrl(
                      null,
                      game.displayGameName,
                      game.gameCode,
                    )}
                    alt={game.displayGameName}
                    className="size-full object-cover"
                    fallback={
                      <span className="grid size-full place-items-center font-mono text-xs font-black text-brand">
                        {game.displayGameName.charAt(0).toUpperCase()}
                      </span>
                    }
                  />
                </span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{ backgroundColor: game.color }}
                    />
                    <span className="truncate text-xs font-bold text-ink-muted">
                      {String(index + 1).padStart(2, "0")} ·{" "}
                      {game.displayGameName}
                    </span>
                  </span>
                </span>
                <span className="text-right">
                  <strong className="block font-mono text-sm font-black text-ink">
                    {formatAdminNumber(game.tournamentCount, locale)}
                  </strong>
                  <span className="block font-mono text-[10px] text-ink-faint">
                    {((game.tournamentCount / chartTotal) * 100).toLocaleString(
                      localeTag(locale),
                      { maximumFractionDigits: 1 },
                    )}
                    %
                  </span>
                </span>
              </li>
            ))}

            {otherTournamentCount > 0 && (
              <li className="flex items-center gap-3 px-2 pt-1 text-[11px] text-ink-faint">
                <span className="size-2 rounded-full bg-ink-faint/40" />
                <span className="min-w-0 flex-1 font-semibold">
                  {t("admin.dashboard.otherGames")}
                </span>
                <span className="font-mono font-bold">
                  {formatAdminNumber(otherTournamentCount, locale)} ·{" "}
                  {(
                    (otherTournamentCount / chartTotal) *
                    100
                  ).toLocaleString(localeTag(locale), {
                    maximumFractionDigits: 1,
                  })}
                  %
                </span>
              </li>
            )}
          </ul>
        </div>
      )}
    </Panel>
  );
}
