"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/store";
import { tournamentsApi } from "@/features/tournaments/api";
import TournamentCard from "@/features/tournaments/components/TournamentCard";
import type { Tournament } from "@/features/tournaments/types";
import { useLocale } from "@/features/locale/store";

export default function MyProfilePage() {
  const router = useRouter();
  const { t } = useLocale();
  const { user, ready } = useAuth();
  const [tab, setTab] = useState<"organized" | "joined">("organized");
  /** Gắn kết quả với tab đã sinh ra nó để suy trạng thái tải, tránh setState trong effect */
  const [result, setResult] = useState<{
    tab: "organized" | "joined";
    data: Tournament[];
  } | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.push("/login");
      return;
    }
    let cancelled = false;
    tournamentsApi
      .findMine(tab)
      .then((res) => {
        if (!cancelled) setResult({ tab, data: res });
      })
      .catch(() => {
        if (!cancelled) setResult({ tab, data: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [tab, router, ready, user]);

  const loading = result?.tab !== tab;
  const tournaments = result?.data ?? [];

  return (
    <div className="my-tournaments-page home-sections w-full flex-1">
      <div className="mx-auto w-full max-w-5xl px-4 py-10">
        <div className="my-tournaments-tabs flex flex-wrap gap-2">
          {(["organized", "joined"] as const).map((tabValue) => {
            const active = tab === tabValue;
            return (
              <button
                key={tabValue}
                onClick={() => setTab(tabValue)}
                className={`min-h-10 border px-4 py-2 text-sm font-semibold transition-[border-color,background-color,color,transform] active:scale-[0.98] ${
                  active
                    ? "border-brand bg-brand text-on-brand"
                    : "border-line bg-surface-card/80 text-ink-muted hover:border-brand/60 hover:bg-surface-hover hover:text-ink"
                }`}
              >
                {t(
                  tabValue === "organized"
                    ? "profile.organized"
                    : "profile.joined",
                )}
              </button>
            );
          })}
        </div>

        <div className="mt-6">
          {loading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div
                  key={i}
                  aria-hidden
                  className="h-[168px] rounded-xl border border-line bg-surface-card"
                />
              ))}
            </div>
          ) : tournaments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-line px-6 py-16 text-center">
              <p className="font-medium text-ink">
                {tab === "organized"
                  ? t("profile.emptyOrganized")
                  : t("profile.emptyJoined")}
              </p>
              <p className="mx-auto mt-2 max-w-sm text-sm text-ink-muted">
                {tab === "organized"
                  ? t("profile.emptyOrganizedHelp")
                  : t("profile.emptyJoinedHelp")}
              </p>
              <Link
                href={tab === "organized" ? "/tournaments/new" : "/"}
                className="my-tournaments-cta mt-5 inline-flex min-h-[var(--control-height)] items-center justify-center bg-brand px-6 py-3 text-sm font-bold text-on-brand transition-[transform,filter] hover:brightness-110 active:scale-[0.98]"
              >
                {tab === "organized"
                  ? t("profile.createTournament")
                  : t("profile.viewOpen")}
              </Link>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {tournaments.map((tournament) => (
                <TournamentCard key={tournament.id} tournament={tournament} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
