"use client";

import { useEffect, useState } from "react";
import {
  ArrowClockwiseIcon,
  CaretLeftIcon,
  CaretRightIcon,
  GavelIcon,
} from "@phosphor-icons/react";
import { secondaryButtonClass } from "@/components/ui";
import { formatLocalizedDate } from "@/features/locale/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { matchesApi } from "@/features/matches/api";
import type {
  TournamentResultReviewItem,
  TournamentResultReviewsResponse,
} from "@/features/matches/types";
import { ApiError } from "@/lib/api/client";

const PAGE_SIZE = 10;
const STATUS_FILTERS: Array<{
  status: TournamentResultReviewItem["status"];
  label: TranslationKey;
  count: keyof TournamentResultReviewsResponse["summary"];
}> = [
  {
    status: "DISPUTED",
    label: "manage.reviewQueue.disputed",
    count: "disputed",
  },
  {
    status: "PENDING_CONFIRMATION",
    label: "manage.reviewQueue.pending",
    count: "pendingConfirmation",
  },
  {
    status: "RESOLVED",
    label: "manage.reviewQueue.resolved",
    count: "resolved",
  },
  {
    status: "CONFIRMED",
    label: "manage.reviewQueue.confirmed",
    count: "confirmed",
  },
];

export default function TournamentResultReviewQueue({
  tournamentId,
  canResolveDisputes,
  busy,
  refreshVersion,
  onOpenMatch,
}: {
  tournamentId: string;
  canResolveDisputes: boolean;
  busy: boolean;
  refreshVersion: number;
  onOpenMatch: (item: TournamentResultReviewItem) => void;
}) {
  const { locale, t } = useLocale();
  const [status, setStatus] =
    useState<TournamentResultReviewItem["status"]>("DISPUTED");
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    key: string;
    response: TournamentResultReviewsResponse | null;
    error: number | null;
  } | null>(null);
  const requestKey = `${tournamentId}:${status}:${page}:${attempt}:${refreshVersion}`;

  useEffect(() => {
    let cancelled = false;
    void matchesApi
      .findTournamentResultReviews(tournamentId, status, page, PAGE_SIZE)
      .then((response) => {
        if (cancelled) return;
        const lastPage = Math.max(1, response.pagination.totalPages);
        if (page > lastPage) {
          setPage(lastPage);
          return;
        }
        setResult({ key: requestKey, response, error: null });
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setResult({
            key: requestKey,
            response: null,
            error: reason instanceof ApiError ? reason.status : 0,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [tournamentId, status, page, requestKey]);

  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") {
        setAttempt((current) => current + 1);
      }
    };
    const timer = window.setInterval(refresh, 60_000);
    window.addEventListener("focus", refresh);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, []);

  const loading = result?.key !== requestKey;
  const response = loading ? null : result?.response;
  const error = loading ? null : result?.error;

  return (
    <section
      id="review-queue"
      aria-labelledby="review-queue-heading"
      className="scroll-mt-28 mt-6 rounded-2xl border border-line bg-surface-card p-4 sm:p-6"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            {t("manage.reviewQueue.eyebrow")}
          </p>
          <h3
            id="review-queue-heading"
            className="mt-1 flex items-center gap-2 text-lg font-bold text-ink"
          >
            <GavelIcon aria-hidden className="text-brand" weight="duotone" />
            {t("manage.reviewQueue.title")}
          </h3>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-ink-muted">
            {t("manage.reviewQueue.description")}
          </p>
        </div>
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={loading}
          onClick={() => setAttempt((current) => current + 1)}
        >
          <ArrowClockwiseIcon aria-hidden />
          {t("manage.reviewQueue.refresh")}
        </button>
      </div>

      <div
        role="group"
        className="mt-5 flex flex-wrap gap-2"
        aria-label={t("manage.reviewQueue.filterLabel")}
      >
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.status}
            type="button"
            aria-pressed={status === filter.status}
            onClick={() => {
              setStatus(filter.status);
              setPage(1);
            }}
            className={`inline-flex min-h-10 items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition ${status === filter.status ? "border-brand bg-brand/10 text-brand" : "border-line text-ink-muted hover:border-brand/50 hover:text-ink"}`}
          >
            {t(filter.label)}
            {result?.response && (
              <span className="rounded-full bg-surface-sub px-2 py-0.5 tabular-nums text-ink">
                {result.response.summary[filter.count]}
              </span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-5" aria-live="polite" aria-busy={loading}>
        {loading ? (
          <div className="space-y-3" aria-label={t("common.loading")}>
            {[0, 1, 2].map((item) => (
              <div
                key={item}
                className="h-24 animate-pulse rounded-xl border border-line bg-surface-sub"
              />
            ))}
          </div>
        ) : error !== null ? (
          <div className="rounded-xl border border-rejected/30 bg-rejected/5 p-5">
            <p role="alert" className="text-sm font-semibold text-rejected">
              {t(
                error === 401
                  ? "manage.reviewQueue.unauthorized"
                  : error === 403
                    ? "manage.reviewQueue.forbidden"
                    : error === 404
                      ? "manage.reviewQueue.notFound"
                      : "manage.reviewQueue.loadError",
              )}
            </p>
            <button
              type="button"
              className={`${secondaryButtonClass} mt-3`}
              onClick={() => setAttempt((current) => current + 1)}
            >
              {t("common.retry")}
            </button>
          </div>
        ) : response?.data.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line px-5 py-8 text-sm text-ink-muted">
            {t("manage.reviewQueue.empty")}
          </p>
        ) : (
          <ol className="space-y-3">
            {response?.data.map((item) => (
              <li
                key={item.matchId}
                className="flex flex-col gap-3 rounded-xl border border-line bg-surface-sub/40 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-brand">
                    {item.roundName}
                    {item.matchNumber != null
                      ? ` · #${item.matchNumber}`
                      : ""}
                  </p>
                  <p className="mt-1 break-words text-sm font-bold text-ink">
                    {item.teamA?.name ?? t("match.awaitingTeam")} ·{" "}
                    {item.teamB?.name ?? t("match.awaitingTeam")}
                  </p>
                  <p className="mt-1 text-xs text-ink-muted">
                    {t("manage.reviewQueue.updatedAt")}{" "}
                    {formatLocalizedDate(item.updatedAt, locale, {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={busy}
                  aria-label={`${t(
                    item.status === "DISPUTED" && canResolveDisputes
                      ? "manage.reviewQueue.resolveMatch"
                      : "manage.reviewQueue.openMatch",
                  )}: ${item.teamA?.name ?? t("match.awaitingTeam")} · ${item.teamB?.name ?? t("match.awaitingTeam")}, ${item.roundName}`}
                  onClick={() => onOpenMatch(item)}
                  className={`${secondaryButtonClass} shrink-0 justify-center`}
                >
                  {t(
                    item.status === "DISPUTED" && canResolveDisputes
                      ? "manage.reviewQueue.resolveMatch"
                      : "manage.reviewQueue.openMatch",
                  )}
                </button>
              </li>
            ))}
          </ol>
        )}
      </div>

      {!loading && response && response.pagination.totalPages > 1 && (
        <nav
          aria-label={t("manage.reviewQueue.pagination")}
          className="mt-5 flex items-center justify-end gap-3"
        >
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
            className={secondaryButtonClass}
          >
            <CaretLeftIcon aria-hidden />
            {t("common.previous")}
          </button>
          <span className="text-xs font-semibold tabular-nums text-ink-muted">
            {page}/{response.pagination.totalPages}
          </span>
          <button
            type="button"
            disabled={page >= response.pagination.totalPages}
            onClick={() => setPage((current) => current + 1)}
            className={secondaryButtonClass}
          >
            {t("common.next")}
            <CaretRightIcon aria-hidden />
          </button>
        </nav>
      )}
    </section>
  );
}
