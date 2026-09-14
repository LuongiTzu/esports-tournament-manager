"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeftIcon, UsersThreeIcon } from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import { useAuth } from "@/features/auth/store";
import { formatLocalizedDate } from "@/features/locale/format";
import { useLocale } from "@/features/locale/store";
import { teamsApi } from "@/features/teams/api";
import type { MyTeam } from "@/features/teams/types";
import StatusBadge from "./StatusBadge";
import TeamDetailLoading from "./TeamDetailLoading";

export default function MyTeamsPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const { locale, t } = useLocale();
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    userId: string;
    teams: MyTeam[];
    error: boolean;
  } | null>(null);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(
        `/login?returnTo=${encodeURIComponent("/users/me/teams")}`,
      );
      return;
    }
    let cancelled = false;
    teamsApi.findMine().then(
      (teams) => {
        if (!cancelled) setResult({ userId: user.id, teams, error: false });
      },
      () => {
        if (!cancelled) setResult({ userId: user.id, teams: [], error: true });
      },
    );
    return () => {
      cancelled = true;
    };
  }, [attempt, ready, router, user]);

  if (!ready || (user && result?.userId !== user.id))
    return <TeamDetailLoading />;
  if (!user) return null;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6">
      <title>{`${t("pageTitle.myTeams")} | ArenaVerse`}</title>
      <Link
        href="/users/me"
        className="inline-flex items-center gap-2 text-sm text-ink-muted hover:text-brand"
      >
        <ArrowLeftIcon aria-hidden />
        {t("profile.myTournaments")}
      </Link>
      <header className="mt-5">
        <h1 className="text-2xl font-black text-ink sm:text-3xl">
          {t("myTeams.title")}
        </h1>
        <p className="mt-2 text-sm text-ink-muted">
          {t("myTeams.description")}
        </p>
      </header>

      {result?.error ? (
        <div className="mt-7">
          <p role="alert" className={alertErrorClass}>
            {t("myTeams.loadError")}
          </p>
          <button
            type="button"
            className={`${secondaryButtonClass} mt-4`}
            onClick={() => {
              setResult(null);
              setAttempt((value) => value + 1);
            }}
          >
            {t("common.retry")}
          </button>
        </div>
      ) : result?.teams.length === 0 ? (
        <div className="mt-7 rounded-2xl border border-dashed border-line px-6 py-16 text-center">
          <UsersThreeIcon size={36} className="mx-auto text-brand" />
          <p className="mt-4 font-semibold text-ink">{t("myTeams.empty")}</p>
          <p className="mt-2 text-sm text-ink-muted">
            {t("myTeams.emptyHint")}
          </p>
          <Link href="/tournaments" className={`${secondaryButtonClass} mt-5`}>
            {t("teamDetail.browse")}
          </Link>
        </div>
      ) : (
        <ul className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {result?.teams.map((team) => (
            <li
              key={team.id}
              className="overflow-hidden rounded-2xl border border-line bg-surface-card"
            >
              <Link
                href={`/teams/${encodeURIComponent(team.id)}`}
                className="block h-full p-5 transition hover:bg-surface-hover focus-visible:outline-2 focus-visible:outline-brand"
              >
                <div className="flex items-start gap-4">
                  <span className="grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-brand/10 font-bold text-brand">
                    <ResolvedImage
                      src={team.logoUrl}
                      alt={team.name}
                      className="size-full object-cover"
                      fallback={team.name.charAt(0).toUpperCase()}
                    />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="break-words font-bold text-ink">
                      {team.name}
                    </h2>
                    <p className="mt-1 break-words text-xs text-ink-muted">
                      {team.tournament.name}
                    </p>
                  </div>
                  <StatusBadge status={team.status} />
                </div>
                <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-xs text-ink-muted">
                  <span>
                    {team._count?.members ?? 0} {t("myTeams.memberCount")}
                  </span>
                  {team.tournament.startDate && (
                    <time dateTime={team.tournament.startDate}>
                      {formatLocalizedDate(team.tournament.startDate, locale)}
                    </time>
                  )}
                </div>
                <p className="mt-4 text-sm font-semibold text-brand">
                  {t("myTeams.manage")}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
