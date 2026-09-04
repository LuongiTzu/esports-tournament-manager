"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ArrowsClockwiseIcon,
  CircleNotchIcon,
  ClockCounterClockwiseIcon,
} from "@phosphor-icons/react";
import { secondaryButtonClass } from "@/components/ui";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { tournamentsApi } from "@/features/tournaments/api";
import type { CompetitionAuditLog } from "@/features/tournaments/types";

const PAGE_SIZE = 20;

export default function CompetitionAuditHistory({
  tournamentId,
}: {
  tournamentId: string;
}) {
  const { locale, t } = useLocale();
  const [entries, setEntries] = useState<CompetitionAuditLog[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    async (nextPage: number, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      setError("");
      try {
        const result = await tournamentsApi.getCompetitionAudit(
          tournamentId,
          nextPage,
          PAGE_SIZE,
        );
        setEntries((current) =>
          append ? [...current, ...result.data] : result.data,
        );
        setPage(result.pagination.page);
        setTotalPages(result.pagination.totalPages);
      } catch (caught) {
        setError(
          caught instanceof Error
            ? caught.message
            : t("competition.audit.loadError"),
        );
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [t, tournamentId],
  );

  useEffect(() => {
    let active = true;
    void tournamentsApi
      .getCompetitionAudit(tournamentId, 1, PAGE_SIZE)
      .then((result) => {
        if (!active) return;
        setEntries(result.data);
        setPage(result.pagination.page);
        setTotalPages(result.pagination.totalPages);
      })
      .catch((caught: unknown) => {
        if (!active) return;
        setError(
          caught instanceof Error
            ? caught.message
            : t("competition.audit.loadError"),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [t, tournamentId]);

  return (
    <section className="mt-6 rounded-2xl border border-line bg-surface-card p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
            {t("competition.audit.eyebrow")}
          </p>
          <h3 className="mt-1 text-lg font-bold text-ink">
            {t("competition.audit.title")}
          </h3>
          <p className="mt-1 text-sm text-ink-muted">
            {t("competition.audit.description")}
          </p>
        </div>
        <button
          type="button"
          className={secondaryButtonClass}
          disabled={loading || loadingMore}
          onClick={() => void load(1, false)}
        >
          {loading ? (
            <CircleNotchIcon className="animate-spin" />
          ) : (
            <ArrowsClockwiseIcon />
          )}
          {t("competition.audit.refresh")}
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 text-sm text-rejected">
          {error}
        </p>
      )}

      {!loading && entries.length === 0 ? (
        <p className="mt-5 rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">
          {t("competition.audit.empty")}
        </p>
      ) : (
        <ol className="mt-5 space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex gap-3 rounded-xl border border-line bg-surface-sub px-4 py-3"
            >
              <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-brand/10 text-brand">
                <ClockCounterClockwiseIcon />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-ink">
                  {t(
                    `competition.audit.action.${entry.action}` as TranslationKey,
                  )}
                </p>
                <p className="mt-1 text-xs text-ink-muted">
                  {entry.actor?.displayName ?? t("competition.audit.system")} ·{" "}
                  {new Intl.DateTimeFormat(locale === "vi" ? "vi-VN" : "en-US", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(entry.createdAt))}
                </p>
                {(entry.roundId || entry.matchId) && (
                  <p className="mt-1 truncate font-mono text-[11px] text-ink-faint">
                    {entry.roundId ? `Round ${entry.roundId}` : ""}
                    {entry.roundId && entry.matchId ? " · " : ""}
                    {entry.matchId ? `Match ${entry.matchId}` : ""}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}

      {page < totalPages && (
        <button
          type="button"
          disabled={loadingMore}
          onClick={() => void load(page + 1, true)}
          className={`${secondaryButtonClass} mt-4 w-full`}
        >
          {loadingMore && <CircleNotchIcon className="animate-spin" />}
          {t("competition.audit.loadMore")}
        </button>
      )}
    </section>
  );
}
