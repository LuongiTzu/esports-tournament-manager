"use client";

import { useEffect, useState } from "react";
import { MagnifyingGlassIcon } from "@phosphor-icons/react";
import { inputClass } from "@/components/ui";
import { gamesApi } from "@/features/games/api";
import type { Game } from "@/features/games/types";
import { useLocale } from "@/features/locale/store";
import { tournamentsApi } from "@/features/tournaments/api";
import {
  TournamentGrid,
  TournamentGridSkeleton,
} from "@/features/tournaments/components/TournamentGrid";
import type { Paginated, Tournament } from "@/features/tournaments/types";

const PAGE_SIZE = 12;

export default function TournamentDiscovery() {
  const { t } = useLocale();
  const [games, setGames] = useState<Game[]>([]);
  const [gamesError, setGamesError] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [gameId, setGameId] = useState("");
  const [status, setStatus] = useState<Tournament["status"] | "">("");
  const [page, setPage] = useState(1);
  const [retryCount, setRetryCount] = useState(0);
  const queryKey = JSON.stringify({ search, gameId, status, page, retryCount });
  const [result, setResult] = useState<{
    key: string;
    response: Paginated<Tournament> | null;
    error: string;
  } | null>(null);

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
    const timeout = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    let cancelled = false;
    tournamentsApi
      .findAll({
        search: search || undefined,
        gameId: gameId || undefined,
        status: status || undefined,
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
  }, [gameId, page, queryKey, search, status, t]);

  const loading = result?.key !== queryKey;
  const response = result?.response;
  const tournaments = response?.data ?? [];
  const pagination = response?.pagination;
  const error = result?.error ?? "";
  const filtering = Boolean(search || gameId || status);

  const statusFilters: Array<{
    value: Tournament["status"] | "";
    label: string;
  }> = [
    { value: "", label: t("tournaments.discovery.allStatuses") },
    { value: "DRAFT", label: t("tournaments.discovery.draft") },
    {
      value: "REGISTRATION",
      label: t("tournaments.discovery.registration"),
    },
    { value: "ONGOING", label: t("tournaments.discovery.ongoing") },
    { value: "COMPLETED", label: t("tournaments.discovery.completed") },
    { value: "CANCELLED", label: t("tournaments.discovery.cancelled") },
  ];

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setGameId("");
    setStatus("");
    setPage(1);
  };

  return (
    <div className="relative w-full flex-1 overflow-hidden">
      <div
        aria-hidden
        className="absolute left-1/2 top-0 -z-10 h-72 w-[56rem] -translate-x-1/2 rounded-full bg-gradient-to-r from-brand/15 to-brand-secondary/10 blur-3xl"
      />
      <header className="border-b border-line bg-surface-card/25">
        <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-brand-hover">
            {t("tournaments.discovery.eyebrow")}
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            {t("tournaments.discovery.title")}
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-ink-muted">
            {t("tournaments.discovery.description")}
          </p>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="rounded-2xl border border-line bg-surface-card/80 p-4 shadow-xl shadow-black/10 sm:p-5">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px_220px]">
            <div>
              <label htmlFor="tournament-search" className="mb-1.5 block text-xs font-semibold text-ink-muted">
                {t("tournaments.discovery.searchLabel")}
              </label>
              <div className="relative">
                <MagnifyingGlassIcon aria-hidden size={19} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint" />
                <input
                  id="tournament-search"
                  type="search"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder={t("tournaments.discovery.searchPlaceholder")}
                  className={`${inputClass} pl-10`}
                />
              </div>
            </div>
            <div>
              <label htmlFor="tournament-game" className="mb-1.5 block text-xs font-semibold text-ink-muted">
                {t("tournaments.discovery.gameLabel")}
              </label>
              <select
                id="tournament-game"
                value={gameId}
                onChange={(event) => {
                  setGameId(event.target.value);
                  setPage(1);
                }}
                className={inputClass}
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
              <label htmlFor="tournament-status" className="mb-1.5 block text-xs font-semibold text-ink-muted">
                {t("tournaments.discovery.statusLabel")}
              </label>
              <select
                id="tournament-status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as Tournament["status"] | "");
                  setPage(1);
                }}
                className={inputClass}
              >
                {statusFilters.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          {gamesError && (
            <p className="mt-3 text-xs text-ink-faint">
              {t("tournaments.discovery.gamesError")}
            </p>
          )}
        </div>

        <div id="tournament-results" className="mt-9" aria-live="polite" aria-busy={loading}>
          {!loading && !error && pagination && (
            <p className="mb-5 text-sm font-medium text-ink-muted">
              <span className="text-ink">{pagination.total}</span>{" "}
              {t("tournaments.discovery.resultCount")}
            </p>
          )}

          {loading ? (
            <>
              <TournamentGridSkeleton count={6} />
              <span className="sr-only">{t("tournaments.discovery.loading")}</span>
            </>
          ) : error ? (
            <div className="rounded-2xl border border-rejected/40 bg-rejected/10 px-6 py-12 text-center">
              <p className="font-medium text-rejected">{error}</p>
              <p className="mt-2 text-sm text-ink-muted">{t("tournaments.discovery.retryHelp")}</p>
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
            <TournamentGrid tournaments={tournaments} />
          )}

          {!loading && !error && pagination && pagination.totalPages > 1 && (
            <nav
              aria-label={t("tournaments.discovery.paginationLabel")}
              className="mt-9 flex items-center justify-center gap-4"
            >
              <button
                type="button"
                disabled={pagination.page <= 1}
                onClick={() => setPage((current) => Math.max(1, current - 1))}
                className="rounded-lg border border-line bg-surface-card px-4 py-2 text-sm font-medium text-ink transition hover:border-brand/45 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {t("tournaments.discovery.previous")}
              </button>
              <span className="text-sm text-ink-muted">
                {t("tournaments.discovery.page")} {pagination.page} / {pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() =>
                  setPage((current) =>
                    Math.min(pagination.totalPages, current + 1),
                  )
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
