"use client";

import { useEffect, useState } from "react";
import {
  FunnelSimpleIcon,
  MagnifyingGlassIcon,
  XIcon,
} from "@phosphor-icons/react";
import { inputClass, secondaryButtonClass } from "@/components/ui";
import type {
  AdminTournamentModerationStatus,
  AdminTournamentsQuery,
} from "@/features/admin/types";
import { gamesApi } from "@/features/games/api";
import type { Game } from "@/features/games/types";
import { useLocale } from "@/features/locale/store";
import type { TournamentStatus } from "@/shared/types/tournament-status";

interface TournamentAdminFiltersProps {
  query: AdminTournamentsQuery;
  searchInput: string;
  onSearchInputChange: (value: string) => void;
  onChange: (query: AdminTournamentsQuery) => void;
  onClear: () => void;
}

const STATUS_OPTIONS: Array<TournamentStatus | ""> = [
  "",
  "DRAFT",
  "REGISTRATION",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
];

const STATUS_LABEL_KEYS = {
  DRAFT: "tournaments.discovery.draft",
  REGISTRATION: "tournaments.discovery.registration",
  ONGOING: "tournaments.discovery.ongoing",
  COMPLETED: "tournaments.discovery.completed",
  CANCELLED: "tournaments.discovery.cancelled",
} as const;

export default function TournamentAdminFilters({
  query,
  searchInput,
  onSearchInputChange,
  onChange,
  onClear,
}: TournamentAdminFiltersProps) {
  const { t } = useLocale();
  const [games, setGames] = useState<Game[]>([]);
  const [gamesError, setGamesError] = useState(false);
  const filtering = Boolean(
    query.search || query.gameId || query.status || query.moderationStatus,
  );

  useEffect(() => {
    let cancelled = false;
    gamesApi
      .findAll()
      .then((items) => {
        if (!cancelled) setGames(items);
      })
      .catch(() => {
        if (!cancelled) setGamesError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const statusLabel = (status: TournamentStatus | "") => {
    if (!status) return t("tournaments.discovery.allStatuses");
    return t(STATUS_LABEL_KEYS[status]);
  };

  return (
    <div className="rounded-2xl border border-line bg-surface-card/70 p-4 shadow-sm backdrop-blur-xl sm:p-5">
      <div className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
        <span className="grid size-8 place-items-center rounded-lg bg-brand/15 text-brand-hover">
          <FunnelSimpleIcon size={18} weight="duotone" />
        </span>
        {t("tournaments.discovery.filters")}
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(17rem,1.4fr)_minmax(11rem,0.8fr)_minmax(11rem,0.8fr)_minmax(12rem,0.9fr)]">
        <div>
          <label
            htmlFor="admin-tournament-search"
            className="mb-1.5 block text-xs font-semibold text-ink-muted"
          >
            {t("tournaments.discovery.searchLabel")}
          </label>
          <div className="relative">
            <MagnifyingGlassIcon
              aria-hidden
              size={19}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint"
            />
            <input
              id="admin-tournament-search"
              type="search"
              value={searchInput}
              onChange={(event) => onSearchInputChange(event.target.value)}
              placeholder={t("tournaments.discovery.searchPlaceholder")}
              className={`${inputClass} h-11 bg-surface/70 pl-10`}
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="admin-tournament-game"
            className="mb-1.5 block text-xs font-semibold text-ink-muted"
          >
            {t("tournaments.discovery.gameLabel")}
          </label>
          <select
            id="admin-tournament-game"
            value={query.gameId ?? ""}
            onChange={(event) =>
              onChange({ ...query, gameId: event.target.value || undefined })
            }
            className={`${inputClass} h-11 bg-surface/70`}
          >
            <option value="">{t("tournaments.discovery.allGames")}</option>
            {games.map((game) => (
              <option key={game.id} value={game.id}>
                {game.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="admin-tournament-status"
            className="mb-1.5 block text-xs font-semibold text-ink-muted"
          >
            {t("tournaments.discovery.statusLabel")}
          </label>
          <select
            id="admin-tournament-status"
            value={query.status ?? ""}
            onChange={(event) =>
              onChange({
                ...query,
                status: (event.target.value || undefined) as
                  TournamentStatus | undefined,
              })
            }
            className={`${inputClass} h-11 bg-surface/70`}
          >
            {STATUS_OPTIONS.map((status) => (
              <option key={status} value={status}>
                {statusLabel(status)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="admin-tournament-moderation"
            className="mb-1.5 block text-xs font-semibold text-ink-muted"
          >
            {t("admin.tournaments.filterAria")}
          </label>
          <select
            id="admin-tournament-moderation"
            value={query.moderationStatus ?? "ALL"}
            onChange={(event) =>
              onChange({
                ...query,
                moderationStatus:
                  event.target.value === "ALL"
                    ? undefined
                    : (event.target.value as AdminTournamentModerationStatus),
              })
            }
            className={`${inputClass} h-11 bg-surface/70`}
          >
            <option value="ALL">{t("admin.tournaments.allModeration")}</option>
            <option value="ACTIVE">{t("admin.tournaments.active")}</option>
            <option value="HIDDEN_BY_ADMIN">
              {t("admin.tournaments.hidden")}
            </option>
          </select>
        </div>
      </div>

      <div className="mt-3 flex min-h-9 flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-ink-faint">
          {gamesError
            ? t("tournaments.discovery.gamesError")
            : t("admin.tournaments.filterLimitation")}
        </p>
        {filtering && (
          <button
            type="button"
            onClick={onClear}
            className={`${secondaryButtonClass} px-3 py-2 text-xs`}
          >
            <XIcon /> {t("admin.users.clearFilters")}
          </button>
        )}
      </div>
    </div>
  );
}
