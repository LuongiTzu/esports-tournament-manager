"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { HeartIcon } from "@phosphor-icons/react";
import { alertErrorClass } from "@/components/ui";
import { useAuth } from "@/features/auth/store";
import { useLocale } from "@/features/locale/store";
import { tournamentsApi } from "@/features/tournaments/api";
import {
  TournamentGrid,
  TournamentGridSkeleton,
} from "@/features/tournaments/components/TournamentGrid";
import type {
  Tournament,
  TournamentFavoriteMutationResult,
} from "@/features/tournaments/types";

type MyTournamentTab = "organized" | "joined" | "favorites";

interface TournamentResult {
  key: string;
  data: Tournament[] | null;
  error: boolean;
}

export default function MyProfilePage() {
  const router = useRouter();
  const { t } = useLocale();
  const { user, ready } = useAuth();
  const [tab, setTab] = useState<MyTournamentTab>("organized");
  const [retryCount, setRetryCount] = useState(0);
  const [result, setResult] = useState<TournamentResult | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: "success" | "error";
    message: string;
  } | null>(null);
  const resultKey = `${tab}:${retryCount}`;

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.push("/login");
      return;
    }

    let cancelled = false;
    const pendingRequest =
      tab === "favorites"
        ? tournamentsApi.findFavorites()
        : tournamentsApi.findMine(tab);
    pendingRequest
      .then((data) => {
        if (!cancelled) setResult({ key: resultKey, data, error: false });
      })
      .catch(() => {
        if (!cancelled) setResult({ key: resultKey, data: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [ready, resultKey, router, tab, user]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 3200);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const loading = !ready || result?.key !== resultKey;
  const tournaments = result?.data ?? [];

  const updateFavoriteItem = (
    tournament: Tournament,
    favoriteState: TournamentFavoriteMutationResult,
  ) => {
    setResult((current) => {
      if (current?.key !== resultKey || !current.data) return current;
      return {
        ...current,
        data: current.data.map((item) =>
          item.id === tournament.id ? { ...item, ...favoriteState } : item,
        ),
      };
    });
  };

  const removeFavoriteItem = (tournament: Tournament) => {
    setResult((current) => {
      if (current?.key !== resultKey || !current.data) return current;
      return {
        ...current,
        data: current.data.filter((item) => item.id !== tournament.id),
      };
    });
  };

  const restoreFavoriteItem = (
    tournament: Tournament,
    favoriteState: TournamentFavoriteMutationResult,
    index: number,
  ) => {
    setResult((current) => {
      if (current?.key !== resultKey || !current.data) return current;
      if (current.data.some((item) => item.id === tournament.id)) {
        return {
          ...current,
          data: current.data.map((item) =>
            item.id === tournament.id ? { ...item, ...favoriteState } : item,
          ),
        };
      }
      const restored = [...current.data];
      restored.splice(Math.min(index, restored.length), 0, {
        ...tournament,
        ...favoriteState,
      });
      return { ...current, data: restored };
    });
  };

  const tabs: Array<{ value: MyTournamentTab; label: string }> = [
    { value: "organized", label: t("profile.organized") },
    { value: "joined", label: t("profile.joined") },
    { value: "favorites", label: t("profile.favorites") },
  ];

  const emptyTitle =
    tab === "organized"
      ? t("profile.emptyOrganized")
      : tab === "joined"
        ? t("profile.emptyJoined")
        : t("profile.emptyFavorites");
  const emptyHelp =
    tab === "organized"
      ? t("profile.emptyOrganizedHelp")
      : tab === "joined"
        ? t("profile.emptyJoinedHelp")
        : t("profile.emptyFavoritesHelp");

  return (
    <div className="my-tournaments-page home-sections w-full flex-1">
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <h1 className="text-2xl font-black text-ink sm:text-3xl">
          {t("profile.myTournaments")}
        </h1>
        <div
          role="tablist"
          aria-label={t("profile.myTournaments")}
          className="my-tournaments-tabs mt-6 flex flex-wrap gap-2"
        >
          {tabs.map(({ value, label }) => {
            const active = tab === value;
            return (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(value)}
                className={`min-h-11 border px-4 py-2 text-sm font-semibold transition-[border-color,background-color,color,transform] active:scale-[0.98] ${
                  active
                    ? "border-brand bg-brand text-on-brand"
                    : "border-line bg-surface-card/80 text-ink-muted hover:border-brand/60 hover:bg-surface-hover hover:text-ink"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-6" role="tabpanel" aria-live="polite">
          {loading ? (
            <>
              <TournamentGridSkeleton count={3} />
              <span className="sr-only">{t("common.loading")}</span>
            </>
          ) : result?.error ? (
            <div className="rounded-xl border border-rejected/35 bg-rejected/10 px-6 py-12 text-center">
              <p role="alert" className={alertErrorClass}>
                {tab === "favorites"
                  ? t("profile.favoritesLoadError")
                  : t("tournaments.discovery.loadError")}
              </p>
              <p className="mt-2 text-sm text-ink-muted">
                {tab === "favorites"
                  ? t("profile.favoritesRetryHelp")
                  : t("tournaments.discovery.retryHelp")}
              </p>
              <button
                type="button"
                onClick={() => setRetryCount((count) => count + 1)}
                className="mt-5 min-h-11 rounded-lg border border-rejected/40 px-4 py-2 text-sm font-semibold text-rejected transition hover:bg-rejected/10"
              >
                {t("common.retry")}
              </button>
            </div>
          ) : tournaments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
              {tab === "favorites" && (
                <HeartIcon
                  aria-hidden
                  size={34}
                  weight="duotone"
                  className="mx-auto mb-4 text-accent"
                />
              )}
              <p className="font-medium text-ink">{emptyTitle}</p>
              <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">
                {emptyHelp}
              </p>
              <Link
                href={tab === "organized" ? "/tournaments/new" : "/tournaments"}
                className="my-tournaments-cta mt-5 inline-flex min-h-[var(--control-height)] items-center justify-center bg-brand px-6 py-3 text-sm font-bold text-on-brand transition-[transform,filter] hover:brightness-110 active:scale-[0.98]"
              >
                {tab === "organized"
                  ? t("profile.createTournament")
                  : tab === "favorites"
                    ? t("profile.browseTournaments")
                    : t("profile.viewOpen")}
              </Link>
            </div>
          ) : (
            <TournamentGrid
              tournaments={tournaments}
              showFavoriteFeedback={tab !== "favorites"}
              onFavoriteOptimisticChange={(tournament, favoriteState) => {
                if (tab === "favorites" && !favoriteState.isFavorited) {
                  removeFavoriteItem(tournament);
                } else {
                  updateFavoriteItem(tournament, favoriteState);
                }
              }}
              onFavoriteReconciled={(tournament, favoriteState) => {
                if (tab !== "favorites") {
                  updateFavoriteItem(tournament, favoriteState);
                  return;
                }
                setFeedback({
                  tone: "success",
                  message: favoriteState.isFavorited
                    ? t("tournament.favorite.savedAndFollowed")
                    : t("tournament.favorite.removedAndUnfollowed"),
                });
              }}
              onFavoriteRollback={(tournament, favoriteState, index) => {
                if (tab === "favorites") {
                  restoreFavoriteItem(tournament, favoriteState, index);
                  setFeedback({
                    tone: "error",
                    message: t("tournament.favorite.failure"),
                  });
                } else {
                  updateFavoriteItem(tournament, favoriteState);
                }
              }}
            />
          )}
        </div>
      </div>

      {feedback && (
        <div
          role={feedback.tone === "error" ? "alert" : "status"}
          className={`fixed bottom-5 right-4 z-[80] max-w-sm rounded-lg border bg-surface-card px-4 py-3 text-sm font-semibold shadow-[var(--shadow-elevated)] sm:right-6 ${
            feedback.tone === "error"
              ? "border-rejected/40 text-rejected"
              : "border-approved/40 text-approved"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}
