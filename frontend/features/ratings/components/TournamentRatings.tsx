"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/store";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import {
  alertErrorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { ratingsApi } from "../api";
import type { OwnRating, RatingList } from "../types";
import StarRatingInput from "./StarRatingInput";

function RatingEditor({
  mine,
  disabled,
  onSave,
}: {
  mine: OwnRating | null;
  disabled: boolean;
  onSave: (score: number, content: string) => Promise<void>;
}) {
  const { t } = useLocale();
  const [score, setScore] = useState(mine?.score ?? 5);
  const [content, setContent] = useState(mine?.content ?? "");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void onSave(score, content);
  };
  return (
    <form onSubmit={submit} className="mt-4 space-y-3">
      <fieldset disabled={disabled} className="space-y-3">
        <StarRatingInput
          value={score}
          onChange={setScore}
          label={t("ratings.score")}
          disabled={disabled}
        />
        <div>
          <label htmlFor="rating-content" className={labelClass}>
            {t("ratings.content")}
          </label>
          <textarea
            id="rating-content"
            rows={3}
            maxLength={2000}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={`${inputClass} mt-1`}
          />
        </div>
        <button type="submit" className={primaryButtonClass}>
          {t(
            disabled
              ? "common.saving"
              : mine
                ? "ratings.update"
                : "ratings.submit",
          )}
        </button>
      </fieldset>
    </form>
  );
}

function RatingsContent({ slug }: { slug: string }) {
  const { t, locale } = useLocale();
  const [page, setPage] = useState(1),
    [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<RatingList | null>(null);
  const [loadError, setLoadError] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [working, setWorking] = useState(false);
  const pending = useRef(false);
  const [needsReload, setNeedsReload] = useState(false);
  useEffect(() => {
    let cancelled = false;
    ratingsApi.list(slug, page).then(
      (value) => {
        if (!cancelled) {
          setResult(value);
          setLoadError("");
          setNeedsReload(false);
        }
      },
      (reason) => {
        if (!cancelled)
          setLoadError(
            reason instanceof Error ? reason.message : t("ratings.loadError"),
          );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [slug, page, attempt, t]);
  const mutate = async (action: () => Promise<unknown>) => {
    if (pending.current || needsReload) return;
    pending.current = true;
    setWorking(true);
    setError("");
    setNotice("");
    try {
      await action();
      setNotice(t("ratings.saved"));
      setNeedsReload(true);
      try {
        setResult(await ratingsApi.list(slug, page));
        setNeedsReload(false);
      } catch {
        setError(t("ratings.refreshError"));
      }
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("ratings.saveError"),
      );
    } finally {
      pending.current = false;
      setWorking(false);
    }
  };
  const changePage = (value: number) => {
    setResult(null);
    setLoadError("");
    setPage(value);
  };
  return (
    <section
      id="ratings"
      aria-labelledby="ratings-heading"
      className="mt-8 scroll-mt-28 border border-line bg-surface-card/90 p-5 sm:p-7"
    >
      <h2 id="ratings-heading" className="text-2xl font-black">
        {t("ratings.title")}
      </h2>
      {loadError ? (
        <p role="alert" className={`${alertErrorClass} mt-4`}>
          {loadError}
        </p>
      ) : (
        !result && (
          <p role="status" className="mt-4">
            {t("common.loading")}
          </p>
        )
      )}
      {(loadError || needsReload) && (
        <button
          type="button"
          disabled={working}
          className={`${secondaryButtonClass} mt-3`}
          onClick={() => setAttempt((n) => n + 1)}
        >
          {t("common.retry")}
        </button>
      )}
      {result && (
        <>
          <p className="mt-4 text-xl font-bold">
            ★{" "}
            {result.summary.average === null
              ? "—"
              : new Intl.NumberFormat(locale, {
                  maximumFractionDigits: 2,
                }).format(result.summary.average)}{" "}
            / 5{" "}
            <span className="text-sm font-normal text-ink-muted">
              ({result.summary.count} {t("ratings.count")})
            </span>
          </p>
          <div className="mt-5 rounded-xl border border-line p-4">
            <h3 className="font-bold">{t("ratings.yours")}</h3>
            {result.mine?.isHidden && (
              <p className="mt-2 text-sm text-pending">
                {t("ratings.hidden")} {result.mine.moderationReason}
              </p>
            )}
            {result.eligibility.canCreate || result.eligibility.canEdit ? (
              <RatingEditor
                key={
                  result.mine
                    ? `${result.mine.id}:${result.mine.updatedAt}`
                    : "new"
                }
                mine={result.mine}
                disabled={working || needsReload}
                onSave={(score, content) =>
                  mutate(() =>
                    ratingsApi.save(
                      slug,
                      { score, content },
                      Boolean(result.mine),
                    ),
                  )
                }
              />
            ) : (
              <p className="mt-2 text-sm text-ink-muted">
                {t(
                  `ratings.reason.${result.eligibility.reason}` as TranslationKey,
                )}
              </p>
            )}
            {result.eligibility.reason === "LOGIN_REQUIRED" && (
              <Link
                className="mt-3 inline-block text-brand underline"
                href={`/login?returnTo=${encodeURIComponent(`/tournaments/${slug}#ratings`)}`}
              >
                {t("auth.login.submit")}
              </Link>
            )}
            {result.eligibility.canDelete && (
              <button
                type="button"
                disabled={working || needsReload}
                className="mt-3 text-sm text-rejected underline disabled:opacity-50"
                onClick={() => {
                  if (window.confirm(t("ratings.deleteConfirm")))
                    void mutate(() => ratingsApi.remove(slug));
                }}
              >
                {t("ratings.delete")}
              </button>
            )}
          </div>
          {error && (
            <p role="alert" className={`${alertErrorClass} mt-4`}>
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="mt-3 text-sm text-approved">
              {notice}
            </p>
          )}
          {!result.data.length && (
            <p className="mt-5 text-ink-muted">{t("ratings.empty")}</p>
          )}
          <ul className="mt-5 space-y-4">
            {result.data.map((rating) => (
              <li key={rating.id} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap justify-between gap-2">
                  <span className="break-words font-bold">
                    {rating.author.displayName}
                  </span>
                  <span aria-label={`${rating.score} / 5`}>
                    {"★".repeat(rating.score)}
                    {"☆".repeat(5 - rating.score)}
                  </span>
                </div>
                {rating.content && (
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm text-ink-muted">
                    {rating.content}
                  </p>
                )}
                <time
                  className="mt-2 block text-xs text-ink-faint"
                  dateTime={rating.createdAt}
                >
                  {new Date(rating.createdAt).toLocaleDateString(locale)}
                </time>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center gap-3">
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={working || page <= 1}
              onClick={() => changePage(page - 1)}
            >
              {t("ratings.previous")}
            </button>
            <span>
              {page} / {Math.max(1, result.pagination.totalPages)}
            </span>
            <button
              type="button"
              className={secondaryButtonClass}
              disabled={working || page >= result.pagination.totalPages}
              onClick={() => changePage(page + 1)}
            >
              {t("ratings.next")}
            </button>
          </div>
        </>
      )}
    </section>
  );
}

export default function TournamentRatings({ slug }: { slug: string }) {
  const { user, ready } = useAuth();
  if (!ready) return null;
  return (
    <RatingsContent
      key={`${slug}:${user?.id ?? "guest"}:${user?.emailVerifiedAt ?? ""}`}
      slug={slug}
    />
  );
}
