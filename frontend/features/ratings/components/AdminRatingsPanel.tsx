"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale } from "@/features/locale/store";
import {
  alertErrorClass,
  inputClass,
  secondaryButtonClass,
} from "@/components/ui";
import { ratingsApi } from "../api";
import type { AdminRating, AdminRatingList } from "../types";

export default function AdminRatingsPanel() {
  const { t } = useLocale();
  const [page, setPage] = useState(1),
    [filter, setFilter] = useState("ALL"),
    [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<AdminRatingList | null>(null);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const pending = useRef(false);
  useEffect(() => {
    let cancelled = false;
    ratingsApi.adminList(page, filter).then(
      (value) => {
        if (!cancelled) {
          setResult(value);
          setError("");
        }
      },
      (reason) => {
        if (!cancelled)
          setError(
            reason instanceof Error ? reason.message : t("ratings.loadError"),
          );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [page, filter, attempt, t]);
  const moderate = async (rating: AdminRating) => {
    if (pending.current) return;
    let reason: string | undefined;
    if (!rating.isHidden) {
      const value = window.prompt(t("ratings.hideReason"));
      if (value === null) return;
      reason = value.trim();
      if (!reason) {
        setError(t("ratings.hideReason"));
        return;
      }
      if (reason.length > 500) {
        setError(t("ratings.reasonLength"));
        return;
      }
    } else if (!window.confirm(t("ratings.restoreConfirm"))) return;
    pending.current = true;
    setWorking(true);
    setError("");
    try {
      await ratingsApi.moderate(rating.id, !rating.isHidden, reason);
      setResult(null);
      setAttempt((n) => n + 1);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("ratings.saveError"),
      );
    } finally {
      pending.current = false;
      setWorking(false);
    }
  };
  return (
    <section
      aria-labelledby="admin-ratings-heading"
      className="rounded-xl border border-line bg-surface-card p-5"
    >
      <h2 id="admin-ratings-heading" className="text-xl font-bold">
        {t("ratings.moderation")}
      </h2>
      <select
        aria-label={t("ratings.filter")}
        disabled={working}
        value={filter}
        className={`${inputClass} mt-3`}
        onChange={(e) => {
          setFilter(e.target.value);
          setPage(1);
          setResult(null);
          setError("");
        }}
      >
        <option value="ALL">{t("ratings.all")}</option>
        <option value="false">{t("ratings.visible")}</option>
        <option value="true">{t("ratings.hiddenLabel")}</option>
      </select>
      {error && (
        <div className="mt-3">
          <p role="alert" className={alertErrorClass}>
            {error}
          </p>
          <button
            className={`${secondaryButtonClass} mt-2`}
            disabled={working}
            onClick={() => setAttempt((n) => n + 1)}
          >
            {t("common.retry")}
          </button>
        </div>
      )}
      {!result && !error && (
        <p role="status" className="mt-3">
          {t("common.loading")}
        </p>
      )}
      {result && (
        <>
          <ul className="mt-4 space-y-3">
            {result.data.map((r) => (
              <li key={r.id} className="rounded-lg border border-line p-4">
                <Link
                  className="break-words font-bold text-brand"
                  href={`/tournaments/${encodeURIComponent(r.tournament.slug)}#ratings`}
                >
                  {r.tournament.name}
                </Link>
                <p className="mt-2 break-words">
                  {r.author.displayName} · {r.score} / 5 ★ ·{" "}
                  {t(r.isHidden ? "ratings.hiddenLabel" : "ratings.visible")}
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm">
                  {r.content}
                </p>
                {r.moderationReason && (
                  <p className="mt-2 break-words text-sm text-pending">
                    {r.moderationReason}
                  </p>
                )}
                <button
                  disabled={working}
                  className={`${secondaryButtonClass} mt-3`}
                  onClick={() => void moderate(r)}
                >
                  {t(r.isHidden ? "ratings.restore" : "ratings.hide")}
                </button>
              </li>
            ))}
          </ul>
          {!result.data.length && <p className="mt-4">{t("ratings.empty")}</p>}
          <div className="mt-4 flex items-center gap-3">
            <button
              className={secondaryButtonClass}
              disabled={working || page <= 1}
              onClick={() => {
                setResult(null);
                setPage((n) => n - 1);
              }}
            >
              {t("ratings.previous")}
            </button>
            <span>
              {page} / {Math.max(1, result.pagination.totalPages)}
            </span>
            <button
              className={secondaryButtonClass}
              disabled={working || page >= result.pagination.totalPages}
              onClick={() => {
                setResult(null);
                setPage((n) => n + 1);
              }}
            >
              {t("ratings.next")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}
