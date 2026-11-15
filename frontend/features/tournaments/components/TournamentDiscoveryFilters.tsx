"use client";

import {
  CaretDownIcon,
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  XIcon,
} from "@phosphor-icons/react";
import type { Game } from "@/features/games/types";
import { useLocale } from "@/features/locale/store";
import type { Tournament, TournamentSort } from "@/features/tournaments/types";

interface Props {
  search: string;
  gameId: string;
  status: Tournament["status"] | "";
  sort: TournamentSort;
  games: Game[];
  gamesError: boolean;
  statuses: Array<{ value: Tournament["status"] | ""; label: string }>;
  onSearchChange: (value: string) => void;
  onGameChange: (value: string) => void;
  onStatusChange: (value: Tournament["status"] | "") => void;
  onSortChange: (value: TournamentSort) => void;
  onClear: () => void;
}

const controlClass =
  "h-12 w-full min-w-0 rounded-sm border border-line bg-surface text-sm text-ink outline-none transition-colors hover:border-line-strong focus:border-brand focus-visible:ring-2 focus-visible:ring-brand/25";
const selectClass =
  controlClass + " cursor-pointer appearance-none pl-3.5 pr-9 [&>option]:bg-surface-card";
const labelClass =
  "mb-2 block text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-muted";
const caretClass =
  "pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint";

export function TournamentDiscoveryFilters({
  search,
  gameId,
  status,
  sort,
  games,
  gamesError,
  statuses,
  onSearchChange,
  onGameChange,
  onStatusChange,
  onSortChange,
  onClear,
}: Props) {
  const { t } = useLocale();
  const filtering = Boolean(search.trim() || gameId || status);

  return (
    <div className="tournament-filter-panel relative z-10 -mt-7 border border-line bg-surface-card shadow-[var(--shadow-elevated)]">
      <div className="flex min-h-14 items-center justify-between gap-4 border-b border-line px-4 sm:px-6">
        <div className="flex items-center gap-2.5 text-sm font-semibold text-ink">
          <FunnelSimpleIcon aria-hidden size={18} className="text-brand-hover" />
          {t("tournaments.discovery.filters")}
        </div>
        {filtering && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-ink-muted transition-colors hover:text-brand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
          >
            <XIcon aria-hidden size={14} />
            {t("tournaments.discovery.clearFilters")}
          </button>
        )}
      </div>

      <div className="grid gap-x-4 gap-y-5 p-4 sm:p-6 md:grid-cols-3 xl:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
        <div className="min-w-0 md:col-span-3 xl:col-span-1">
          <label htmlFor="tournament-search" className={labelClass}>
            {t("tournaments.discovery.searchLabel")}
          </label>
          <div className="relative">
            <MagnifyingGlassIcon
              aria-hidden
              size={19}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-brand-hover"
            />
            <input
              id="tournament-search"
              type="search"
              maxLength={100}
              value={search}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t("tournaments.discovery.searchPlaceholder")}
              className={controlClass + " px-3.5 pl-10 placeholder:text-ink-faint"}
            />
          </div>
        </div>

        <div className="min-w-0">
          <label htmlFor="tournament-game" className={labelClass}>
            {t("tournaments.discovery.gameLabel")}
          </label>
          <div className="relative">
            <select
              id="tournament-game"
              value={gameId}
              onChange={(event) => onGameChange(event.target.value)}
              className={selectClass}
            >
              <option value="">{t("tournaments.discovery.allGames")}</option>
              {games.map((game) => (
                <option key={game.id} value={game.id}>
                  {game.name}
                </option>
              ))}
            </select>
            <CaretDownIcon aria-hidden size={15} className={caretClass} />
          </div>
        </div>

        <div className="min-w-0">
          <label htmlFor="tournament-status" className={labelClass}>
            {t("tournaments.discovery.statusLabel")}
          </label>
          <div className="relative">
            <select
              id="tournament-status"
              value={status}
              onChange={(event) =>
                onStatusChange(event.target.value as Tournament["status"] | "")
              }
              className={selectClass}
            >
              {statuses.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <CaretDownIcon aria-hidden size={15} className={caretClass} />
          </div>
        </div>

        <div className="min-w-0">
          <label htmlFor="tournament-sort" className={labelClass}>
            {t("tournaments.discovery.sortLabel")}
          </label>
          <div className="relative">
            <select
              id="tournament-sort"
              value={sort}
              onChange={(event) =>
                onSortChange(event.target.value as TournamentSort)
              }
              className={selectClass}
            >
              <option value="recommended">
                {t("tournaments.discovery.sortRecommended")}
              </option>
              <option value="name">{t("tournaments.discovery.sortName")}</option>
              <option value="newest">{t("tournaments.discovery.sortNewest")}</option>
              <option value="teams">{t("tournaments.discovery.sortTeams")}</option>
            </select>
            <CaretDownIcon aria-hidden size={15} className={caretClass} />
          </div>
        </div>
      </div>

      {gamesError && (
        <p role="status" className="px-4 pb-4 text-xs text-ink-faint sm:px-6 sm:pb-6">
          {t("tournaments.discovery.gamesError")}
        </p>
      )}
    </div>
  );
}
