"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  FunnelSimpleIcon,
  ListBulletsIcon,
  MagnifyingGlassIcon,
  SquaresFourIcon,
} from "@phosphor-icons/react";
import { inputClass } from "@/components/ui";
import { gamesApi } from "@/features/games/api";
import type { Game } from "@/features/games/types";
import { useLocale } from "@/features/locale/store";
import { tournamentsApi } from "@/features/tournaments/api";
import {
  TournamentGrid,
  TournamentGridSkeleton,
  type TournamentView,
} from "@/features/tournaments/components/TournamentGrid";
import type {
  Paginated,
  Tournament,
  TournamentFavoriteMutationResult,
  TournamentSort,
} from "@/features/tournaments/types";

const PAGE_SIZE = 12;
const PUBLIC_STATUSES = [
  "REGISTRATION",
  "ONGOING",
  "COMPLETED",
  "CANCELLED",
] as const satisfies readonly Tournament["status"][];
const TOURNAMENT_SORTS = ["recommended", "name", "newest", "teams"] as const;

function readStatus(value: string | null): Tournament["status"] | "" {
  return PUBLIC_STATUSES.includes(value as (typeof PUBLIC_STATUSES)[number])
    ? (value as Tournament["status"])
    : "";
}

function readSort(value: string | null): TournamentSort {
  return TOURNAMENT_SORTS.includes(value as TournamentSort)
    ? (value as TournamentSort)
    : "recommended";
}

function readPage(value: string | null) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
}

export default function TournamentDiscovery() {
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const search = searchParams.get("search")?.trim() ?? "";
  const gameId = searchParams.get("gameId")?.trim() ?? "";
  const status = readStatus(searchParams.get("status"));
  const sort = readSort(searchParams.get("sort"));
  const view: TournamentView =
    searchParams.get("view") === "list" ? "list" : "grid";
  const page = readPage(searchParams.get("page"));
  const [games, setGames] = useState<Game[]>([]);
  const [gamesError, setGamesError] = useState(false);
  const [searchDraft, setSearchDraft] = useState(() => ({
    value: search,
    source: search,
  }));
  const searchInput =
    searchDraft.source === search ? searchDraft.value : search;
  const [retryCount, setRetryCount] = useState(0);
  const queryKey = JSON.stringify({
    search,
    gameId,
    status,
    sort,
    page,
    retryCount,
  });
  const [result, setResult] = useState<{
    key: string;
    response: Paginated<Tournament> | null;
    error: string;
  } | null>(null);

  const updateQuery = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      Object.entries(patch).forEach(([key, value]) => {
        if (value) next.set(key, value);
        else next.delete(key);
      });
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  useEffect(() => {
    let cancelled = false;
    gamesApi
      .findAll()
      .then((data) => {
        if (!cancelled) setGames(data);
      })
      .catch(() => {
        if (!cancelled) setGamesError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const normalizedSearch = searchInput.trim();
    if (normalizedSearch === search) return;

    const timeout = window.setTimeout(() => {
      updateQuery({ search: normalizedSearch || null, page: null });
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [search, searchInput, updateQuery]);

  useEffect(() => {
    let cancelled = false;
    tournamentsApi
      .findAll({
        search: search || undefined,
        gameId: gameId || undefined,
        status: status || undefined,
        sort,
        page,
        limit: PAGE_SIZE,
      })
      .then((response) => {
        if (!cancelled) setResult({ key: queryKey, response, error: "" });
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setResult({
            key: queryKey,
            response: null,
            error:
              error instanceof Error
                ? error.message
                : t("tournaments.discovery.loadError"),
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [gameId, page, queryKey, search, sort, status, t]);

  const loading = result?.key !== queryKey;
  const response = result?.response;
  const tournaments = useMemo(() => response?.data ?? [], [response?.data]);
  const pagination = response?.pagination;
  const error = result?.error ?? "";
  const filtering = Boolean(search || gameId || status);

  const statusFilters: Array<{
    value: Tournament["status"] | "";
    label: string;
  }> = [
    { value: "", label: t("tournaments.discovery.allStatuses") },
    {
      value: "REGISTRATION",
      label: t("tournaments.discovery.registration"),
    },
    { value: "ONGOING", label: t("tournaments.discovery.ongoing") },
    { value: "COMPLETED", label: t("tournaments.discovery.completed") },
    { value: "CANCELLED", label: t("tournaments.discovery.cancelled") },
  ];

  const clearFilters = () => {
    setSearchDraft({ value: "", source: search });
    updateQuery({ search: null, gameId: null, status: null, page: null });
  };

  const updateFavoriteState = (
    tournament: Tournament,
    favoriteState: TournamentFavoriteMutationResult,
  ) => {
    setResult((current) => {
      if (!current?.response) return current;
      return {
        ...current,
        response: {
          ...current.response,
          data: current.response.data.map((item) =>
            item.id === tournament.id ? { ...item, ...favoriteState } : item,
          ),
        },
      };
    });
  };

  return (
    <div className="tournament-discovery-page relative w-full flex-1 overflow-x-clip bg-surface">
      <header className="tournament-discovery-hero relative isolate min-h-64 overflow-hidden border-b border-line sm:min-h-72">
        <div
          aria-hidden
          className="absolute inset-0 -z-20 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('/images/tournaments/common/backgrounds/tournament-collage.png')",
          }}
        />
        <div
          aria-hidden
          className="tournament-discovery-hero-overlay absolute inset-0 -z-10 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--color-surface)_68%,transparent),color-mix(in_oklab,var(--color-surface)_18%,transparent)_50%,color-mix(in_oklab,var(--color-surface)_68%,transparent)),linear-gradient(0deg,color-mix(in_oklab,var(--color-surface)_78%,transparent),transparent_72%)]"
        />
        <div className="mx-auto flex min-h-64 max-w-7xl flex-col items-center justify-center px-4 py-12 text-center sm:min-h-72 sm:px-6 lg:px-8">
          <p className="tournament-discovery-eyebrow text-xs font-extrabold uppercase tracking-[0.3em] text-brand-hover">
            {t("tournaments.discovery.eyebrow")}
          </p>
          <h1 className="tournament-discovery-title mt-4 max-w-4xl text-balance text-[clamp(1.75rem,3vw,2.35rem)] font-black leading-[1.18] tracking-tight text-ink drop-shadow-[0_3px_14px_rgba(0,0,0,0.85)]">
            {t("tournaments.discovery.heroTitle")}
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-ink-muted sm:text-base">
            {t("tournaments.discovery.description")}
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8 lg:pb-20">
        <div className="tournament-filter-panel relative z-10 -mt-7 rounded-2xl border border-line bg-surface-card/95 p-4 shadow-[var(--shadow-elevated)] backdrop-blur-xl sm:p-5">
          <div className="mb-4 flex items-center gap-2 text-sm font-bold text-ink">
            <span className="grid size-8 place-items-center rounded-lg bg-brand/15 text-brand-hover">
              <FunnelSimpleIcon size={18} weight="duotone" />
            </span>
            {t("tournaments.discovery.filters")}
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[minmax(18rem,1.4fr)_minmax(11rem,0.7fr)_minmax(11rem,0.7fr)_minmax(11rem,0.7fr)]">
            <div>
              <label
                htmlFor="tournament-search"
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
                  id="tournament-search"
                  type="search"
                  value={searchInput}
                  onChange={(event) =>
                    setSearchDraft({ value: event.target.value, source: search })
                  }
                  placeholder={t("tournaments.discovery.searchPlaceholder")}
                  className={`${inputClass} h-11 bg-surface pl-10`}
                />
              </div>
            </div>
            <div>
              <label
                htmlFor="tournament-game"
                className="mb-1.5 block text-xs font-semibold text-ink-muted"
              >
                {t("tournaments.discovery.gameLabel")}
              </label>
              <select
                id="tournament-game"
                value={gameId}
                onChange={(event) => {
                  updateQuery({
                    gameId: event.target.value || null,
                    page: null,
                  });
                }}
                className={`${inputClass} h-11 bg-surface`}
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
                htmlFor="tournament-status"
                className="mb-1.5 block text-xs font-semibold text-ink-muted"
              >
                {t("tournaments.discovery.statusLabel")}
              </label>
              <select
                id="tournament-status"
                value={status}
                onChange={(event) => {
                  updateQuery({
                    status: event.target.value || null,
                    page: null,
                  });
                }}
                className={`${inputClass} h-11 bg-surface`}
              >
                {statusFilters.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="tournament-sort"
                className="mb-1.5 block text-xs font-semibold text-ink-muted"
              >
                {t("tournaments.discovery.sortLabel")}
              </label>
              <select
                id="tournament-sort"
                value={sort}
                onChange={(event) => {
                  const nextSort = event.target.value as TournamentSort;
                  updateQuery({
                    sort: nextSort === "recommended" ? null : nextSort,
                    page: null,
                  });
                }}
                className={`${inputClass} h-11 bg-surface`}
              >
                <option value="recommended">
                  {t("tournaments.discovery.sortRecommended")}
                </option>
                <option value="name">
                  {t("tournaments.discovery.sortName")}
                </option>
                <option value="newest">
                  {t("tournaments.discovery.sortNewest")}
                </option>
                <option value="teams">
                  {t("tournaments.discovery.sortTeams")}
                </option>
              </select>
            </div>
          </div>
          {gamesError && (
            <p className="mt-3 text-xs text-ink-faint">
              {t("tournaments.discovery.gamesError")}
            </p>
          )}
        </div>

        <div
          id="tournament-results"
          className="mt-9"
          aria-live="polite"
          aria-busy={loading}
        >
          <div className="mb-5 flex min-h-10 flex-wrap items-center justify-between gap-3">
            {!loading && !error && pagination ? (
              <div>
                <h2 className="text-lg font-bold text-ink">
                  {t("tournaments.discovery.title")}
                </h2>
                <p className="mt-0.5 text-sm text-ink-muted">
                  <span className="font-semibold text-ink">
                    {pagination.total}
                  </span>{" "}
                  {t("tournaments.discovery.resultCount")}
                </p>
              </div>
            ) : (
              <span />
            )}

            <div className="flex items-center gap-2">
              {filtering && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mr-1 rounded-lg px-3 py-2 text-xs font-semibold text-ink-muted transition hover:bg-surface-sub hover:text-ink"
                >
                  {t("tournaments.discovery.clearFilters")}
                </button>
              )}
              <div
                role="group"
                aria-label={t("tournaments.discovery.viewLabel")}
                className="inline-flex rounded-lg border border-line bg-surface-card p-1"
              >
                <button
                  type="button"
                  aria-label={t("tournaments.discovery.gridView")}
                  aria-pressed={view === "grid"}
                  onClick={() => updateQuery({ view: null })}
                  className={`grid size-9 place-items-center rounded-md transition ${
                    view === "grid"
                      ? "tournament-view-active bg-brand text-on-brand shadow-md shadow-brand/20"
                      : "text-ink-faint hover:bg-surface-sub hover:text-ink"
                  }`}
                >
                  <SquaresFourIcon size={18} weight="bold" />
                </button>
                <button
                  type="button"
                  aria-label={t("tournaments.discovery.listView")}
                  aria-pressed={view === "list"}
                  onClick={() => updateQuery({ view: "list" })}
                  className={`grid size-9 place-items-center rounded-md transition ${
                    view === "list"
                      ? "tournament-view-active bg-brand text-on-brand shadow-md shadow-brand/20"
                      : "text-ink-faint hover:bg-surface-sub hover:text-ink"
                  }`}
                >
                  <ListBulletsIcon size={19} weight="bold" />
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <>
              <TournamentGridSkeleton count={6} view={view} />
              <span className="sr-only">
                {t("tournaments.discovery.loading")}
              </span>
            </>
          ) : error ? (
            <div className="rounded-2xl border border-rejected/40 bg-rejected/10 px-6 py-12 text-center">
              <p className="font-medium text-rejected">{error}</p>
              <p className="mt-2 text-sm text-ink-muted">
                {t("tournaments.discovery.retryHelp")}
              </p>
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="mt-5 rounded-lg border border-rejected/40 px-4 py-2 text-sm font-semibold text-rejected transition hover:bg-rejected/10"
              >
                {t("tournaments.discovery.retry")}
              </button>
            </div>
          ) : tournaments.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
              <p className="font-semibold text-ink">
                {filtering
                  ? t("tournaments.discovery.noMatches")
                  : t("tournaments.discovery.empty")}
              </p>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
                {filtering
                  ? t("tournaments.discovery.noMatchesHelp")
                  : t("tournaments.discovery.emptyHelp")}
              </p>
              {filtering && (
                <button
                  type="button"
                  onClick={clearFilters}
                  className="mt-5 text-sm font-semibold text-brand-hover hover:underline"
                >
                  {t("tournaments.discovery.clearFilters")}
                </button>
              )}
            </div>
          ) : (
            <TournamentGrid
              tournaments={tournaments}
              view={view}
              onFavoriteOptimisticChange={updateFavoriteState}
              onFavoriteReconciled={updateFavoriteState}
              onFavoriteRollback={updateFavoriteState}
            />
          )}

          {!loading && !error && pagination && pagination.totalPages > 1 && (
            <nav
              aria-label={t("tournaments.discovery.paginationLabel")}
              className="mt-9 flex items-center justify-center gap-4"
            >
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => {
                  const previousPage = Math.max(1, pagination.page - 1);
                  updateQuery({
                    page: previousPage === 1 ? null : String(previousPage),
                  });
                }}
                className="rounded-lg border border-line bg-surface-card px-4 py-2 text-sm font-medium text-ink transition hover:border-brand/45 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("tournaments.discovery.previous")}
              </button>
              <span className="text-sm text-ink-muted">
                {t("tournaments.discovery.page")} {pagination.page} /{" "}
                {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  updateQuery({
                    page: String(
                      Math.min(pagination.totalPages, pagination.page + 1),
                    ),
                  })
                }
                className="rounded-lg border border-line bg-surface-card px-4 py-2 text-sm font-medium text-ink transition hover:border-brand/45 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("tournaments.discovery.next")}
              </button>
            </nav>
          )}
        </div>
      </section>
    </div>
  );
}
