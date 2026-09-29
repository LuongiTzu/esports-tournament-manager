"use client";

import { useEffect, useState } from "react";
import { StarIcon } from "@phosphor-icons/react";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import { useLocale } from "@/features/locale/store";
import { tournamentsApi } from "@/features/tournaments/api";
import {
  TournamentGrid,
  TournamentGridSkeleton,
} from "@/features/tournaments/components/TournamentGrid";
import type { Paginated, Tournament } from "@/features/tournaments/types";

const PAGE_SIZE = 12;

export default function RatingDiscovery() {
  const { t } = useLocale();
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const requestKey = `${page}:${attempt}`;
  const [result, setResult] = useState<{
    key: string;
    data: Paginated<Tournament> | null;
    error: string;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    tournamentsApi
      .findAll({
        status: "COMPLETED",
        sort: "newest",
        page,
        limit: PAGE_SIZE,
      })
      .then((data) => {
        if (!cancelled) setResult({ key: requestKey, data, error: "" });
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setResult({
          key: requestKey,
          data: null,
          error:
            reason instanceof Error
              ? reason.message
              : t("ratings.discovery.loadError"),
        });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt, page, requestKey, t]);

  const currentResult = result?.key === requestKey ? result : null;
  const loading = !currentResult;
  const response = currentResult?.data;
  const error = currentResult?.error ?? "";

  const changePage = (nextPage: number) => {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <main className="w-full flex-1 bg-surface">
      <header className="border-b border-line bg-surface-card/70">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-accent">
            <StarIcon size={17} weight="fill" aria-hidden />
            {t("ratings.discovery.eyebrow")}
          </p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-ink sm:text-4xl">
            {t("ratings.discovery.title")}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
            {t("ratings.discovery.description")}
          </p>
        </div>
      </header>

      <section
        id="rating-results"
        className="scroll-mt-20 mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8"
      >
        {loading ? (
          <TournamentGridSkeleton count={6} />
        ) : error ? (
          <div className="rounded-xl border border-rejected/35 bg-rejected/10 p-6 text-center">
            <p role="alert" className={alertErrorClass}>
              {error}
            </p>
            <button
              type="button"
              className={`${secondaryButtonClass} mt-4`}
              onClick={() => setAttempt((value) => value + 1)}
            >
              {t("common.retry")}
            </button>
          </div>
        ) : response && response.data.length > 0 ? (
          <>
            <TournamentGrid
              tournaments={response.data}
              getTournamentHref={(tournament) =>
                `/tournaments/${tournament.slug}?returnTo=${encodeURIComponent("/ratings#rating-results")}#ratings`
              }
            />
            {response.pagination.totalPages > 1 && (
              <nav
                aria-label={t("ratings.discovery.title")}
                className="mt-8 flex items-center justify-center gap-3"
              >
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={page <= 1}
                  onClick={() => changePage(page - 1)}
                >
                  {t("ratings.discovery.previous")}
                </button>
                <span className="text-sm font-semibold text-ink-muted">
                  {page} / {response.pagination.totalPages}
                </span>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={page >= response.pagination.totalPages}
                  onClick={() => changePage(page + 1)}
                >
                  {t("ratings.discovery.next")}
                </button>
              </nav>
            )}
          </>
        ) : (
          <p className="rounded-xl border border-dashed border-line p-10 text-center text-ink-muted">
            {t("ratings.discovery.empty")}
          </p>
        )}
      </section>
    </main>
  );
}
