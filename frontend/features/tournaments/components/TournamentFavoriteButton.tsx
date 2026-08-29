"use client";

import { useEffect, useState, type MouseEvent } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { HeartIcon } from "@phosphor-icons/react";
import { clearSession, useAuth } from "@/features/auth/store";
import { useLocale } from "@/features/locale/store";
import { tournamentsApi } from "@/features/tournaments/api";
import type { TournamentFavoriteMutationResult } from "@/features/tournaments/types";
import { ApiError } from "@/lib/api/client";

interface TournamentFavoriteButtonProps {
  slug: string;
  isFavorited: boolean;
  favoriteCount: number;
  showCount?: boolean;
  compact?: boolean;
  className?: string;
  onOptimisticChange?: (state: TournamentFavoriteMutationResult) => void;
  onReconciled?: (state: TournamentFavoriteMutationResult) => void;
  onRollback?: (state: TournamentFavoriteMutationResult) => void;
  showFeedback?: boolean;
}

type Feedback = { tone: "success" | "error"; message: string } | null;

export default function TournamentFavoriteButton({
  slug,
  isFavorited: initialIsFavorited,
  favoriteCount: initialFavoriteCount,
  showCount = true,
  compact = false,
  className = "",
  onOptimisticChange,
  onReconciled,
  onRollback,
  showFeedback = true,
}: TournamentFavoriteButtonProps) {
  const router = useRouter();
  const { user, ready } = useAuth();
  const { t } = useLocale();
  const [state, setState] = useState<TournamentFavoriteMutationResult>({
    isFavorited: initialIsFavorited,
    favoriteCount: initialFavoriteCount,
  });
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const label = state.isFavorited
    ? t("tournament.favorite.removeAndUnfollow")
    : t("tournament.favorite.saveAndFollow");

  const handleClick = async (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    event.stopPropagation();
    if (pending || !ready) return;
    if (!user) {
      router.push("/login");
      return;
    }

    const previous = state;
    const optimistic = {
      isFavorited: !previous.isFavorited,
      favoriteCount: Math.max(
        0,
        previous.favoriteCount + (previous.isFavorited ? -1 : 1),
      ),
    };
    setPending(true);
    setFeedback(null);
    setState(optimistic);
    onOptimisticChange?.(optimistic);

    try {
      const result = previous.isFavorited
        ? await tournamentsApi.unfavorite(slug)
        : await tournamentsApi.favorite(slug);
      setState(result);
      onReconciled?.(result);
      if (showFeedback) {
        setFeedback({
          tone: "success",
          message: result.isFavorited
            ? t("tournament.favorite.savedAndFollowed")
            : t("tournament.favorite.removedAndUnfollowed"),
        });
      }
    } catch (error: unknown) {
      setState(previous);
      onRollback?.(previous);
      if (error instanceof ApiError && error.status === 401) {
        clearSession();
        router.push("/login");
        return;
      }
      if (showFeedback) {
        setFeedback({
          tone: "error",
          message: t("tournament.favorite.failure"),
        });
      }
    } finally {
      setPending(false);
    }
  };

  return (
    <div className={`group/favorite relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label={label}
        aria-pressed={state.isFavorited}
        aria-busy={pending}
        disabled={pending || !ready}
        onClick={handleClick}
        className={`relative z-20 inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border font-semibold shadow-sm backdrop-blur-md transition-[color,background-color,border-color,transform,opacity] focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] motion-safe:active:scale-95 disabled:cursor-wait disabled:opacity-70 ${
          compact ? "min-w-11 px-2.5 text-xs" : "px-3.5 text-sm"
        } ${
          state.isFavorited
            ? "border-accent/45 bg-accent/15 text-accent hover:bg-accent/20"
            : "border-line bg-surface-card/90 text-ink-muted hover:border-accent/45 hover:text-accent"
        }`}
      >
        <HeartIcon
          aria-hidden
          size={compact ? 19 : 20}
          weight={state.isFavorited ? "fill" : "bold"}
          className={
            state.isFavorited
              ? "motion-safe:animate-[pulse_300ms_ease-out_1]"
              : ""
          }
        />
        {showCount && <span>{state.favoriteCount}</span>}
      </button>

      <span
        role="tooltip"
        className={`pointer-events-none absolute z-40 hidden w-max max-w-64 rounded-md bg-ink px-3 py-2 text-center text-xs font-medium text-surface opacity-0 shadow-lg transition-opacity sm:block sm:group-hover/favorite:opacity-100 sm:group-focus-within/favorite:opacity-100 ${
          compact
            ? "right-0 top-full mt-2"
            : "bottom-full left-1/2 mb-2 -translate-x-1/2"
        }`}
      >
        {label}
      </span>

      {feedback && typeof document !== "undefined"
        ? createPortal(
            <div
              role={feedback.tone === "error" ? "alert" : "status"}
              className={`fixed bottom-5 right-4 z-[80] max-w-sm rounded-lg border px-4 py-3 text-sm font-semibold shadow-[var(--shadow-elevated)] sm:right-6 ${
                feedback.tone === "error"
                  ? "border-rejected/40 bg-surface-card text-rejected"
                  : "border-approved/40 bg-surface-card text-approved"
              }`}
            >
              {feedback.message}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
