"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  CalendarBlankIcon,
  CalendarDotsIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CheckCircleIcon,
  ClockIcon,
  GameControllerIcon,
  LinkSimpleIcon,
  SignInIcon,
  TrophyIcon,
} from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import { useAuth } from "@/features/auth/store";
import { matchesApi } from "@/features/matches/api";
import type { MyMatch, MyMatchesResponse } from "@/features/matches/types";
import {
  formatLocalizedDate,
  formatRelativeDate,
} from "@/features/locale/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import type { MatchStatus } from "@/features/tournaments/types";

const PAGE_SIZE = 12;

const STATUS_TABS: Array<{
  status: MatchStatus;
  label: TranslationKey;
  summaryKey: "pending" | "ongoing" | "completed";
}> = [
  {
    status: "PENDING",
    label: "myMatches.tab.upcoming",
    summaryKey: "pending",
  },
  {
    status: "ONGOING",
    label: "myMatches.tab.ongoing",
    summaryKey: "ongoing",
  },
  {
    status: "COMPLETED",
    label: "myMatches.tab.completed",
    summaryKey: "completed",
  },
];

const statusTone: Record<MatchStatus, string> = {
  PENDING: "border-pending/35 bg-pending/10 text-pending",
  ONGOING: "border-brand/35 bg-brand/10 text-brand",
  COMPLETED: "border-approved/35 bg-approved/10 text-approved",
};

function MatchCard({
  match,
  featured = false,
  now,
  checkingInKey,
  feedback,
  onCheckIn,
}: {
  match: MyMatch;
  featured?: boolean;
  now: number;
  checkingInKey: string | null;
  feedback: { matchId: string; type: "success" | "error" } | null;
  onCheckIn: (matchId: string, teamId: string) => void;
}) {
  const { locale, t } = useLocale();
  const tournament = match.round.tournament;
  const hasScore = match.status !== "PENDING";
  const scheduleLabel = match.scheduledAt
    ? formatLocalizedDate(match.scheduledAt, locale, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : t("myMatches.unscheduled");
  const teams = [
    { slot: "A" as const, team: match.teamA, score: match.scoreA },
    { slot: "B" as const, team: match.teamB, score: match.scoreB },
  ];
  const captainTeamId = match.captainTeamIds.find((teamId) =>
    match.userTeamIds.includes(teamId),
  );
  const captainCheckIn = captainTeamId
    ? match.checkIns.find((checkIn) => checkIn.teamId === captainTeamId)
    : undefined;
  const checkInKey = captainTeamId
    ? `${match.id}:${captainTeamId}`
    : null;
  const opensAt = match.checkInWindow
    ? new Date(match.checkInWindow.opensAt).getTime()
    : null;
  const closesAt = match.checkInWindow
    ? new Date(match.checkInWindow.closesAt).getTime()
    : null;
  const checkInOpen = Boolean(
    now &&
      opensAt !== null &&
      closesAt !== null &&
      now >= opensAt &&
      now <= closesAt,
  );

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-surface-card shadow-sm ${
        featured ? "border-brand/45 shadow-brand/10" : "border-line"
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-sub/55 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand/10 text-brand">
            <ResolvedImage
              src={tournament.game.iconUrl}
              alt=""
              className="size-full object-cover"
              fallback={<GameControllerIcon weight="duotone" />}
            />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-ink">
              {tournament.name}
            </p>
            <p className="truncate text-xs text-ink-muted">
              {tournament.displayGameName}
            </p>
          </div>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusTone[match.status]}`}
        >
          {t(`match.status.${match.status}`)}
        </span>
      </div>

      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-ink-muted">
          <span className="font-semibold text-ink">{match.round.name}</span>
          <span>
            BO{match.bestOf}
            {match.matchNumber ? ` · #${match.matchNumber}` : ""}
          </span>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border border-line">
          {teams.map(({ slot, team, score }, index) => {
            const isMine = Boolean(team && match.userTeamIds.includes(team.id));
            const isWinner = Boolean(team && match.winner?.id === team.id);
            const teamCheckIn = team
              ? match.checkIns.find((checkIn) => checkIn.teamId === team.id)
              : undefined;
            return (
              <div
                key={slot}
                className={`flex min-h-16 items-center gap-3 px-3 py-2.5 ${
                  index > 0 ? "border-t border-line" : ""
                } ${isMine ? "bg-brand/7" : "bg-surface-card"}`}
              >
                <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-lg bg-surface-sub text-sm font-bold text-brand">
                  <ResolvedImage
                    src={team?.logoUrl}
                    alt=""
                    className="size-full object-cover"
                    fallback={team?.name.charAt(0).toUpperCase() ?? "?"}
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <p
                    className={`truncate text-sm font-semibold ${
                      isWinner ? "text-approved" : "text-ink"
                    }`}
                  >
                    {team?.name ?? t("match.awaitingTeam")}
                  </p>
                  {isMine && (
                    <p className="mt-0.5 text-[11px] font-semibold text-brand">
                      {t("myMatches.yourTeam")}
                    </p>
                  )}
                  {team && match.status !== "COMPLETED" && (
                    <p
                      className={`mt-0.5 inline-flex items-center gap-1 text-[11px] font-semibold ${
                        teamCheckIn ? "text-approved" : "text-ink-muted"
                      }`}
                    >
                      {teamCheckIn && <CheckCircleIcon weight="fill" />}
                      {t(
                        teamCheckIn
                          ? "myMatches.checkIn.checkedIn"
                          : "myMatches.checkIn.pending",
                      )}
                    </p>
                  )}
                </div>
                {hasScore && (
                  <strong
                    className={`text-xl tabular-nums ${
                      isWinner ? "text-approved" : "text-ink"
                    }`}
                  >
                    {score}
                  </strong>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-4 grid gap-2 text-xs text-ink-muted sm:grid-cols-2">
          <span className="inline-flex items-center gap-2">
            <CalendarBlankIcon className="shrink-0 text-brand" />
            <time dateTime={match.scheduledAt ?? undefined}>
              {scheduleLabel}
            </time>
          </span>
          {match.scheduledAt && (
            <span className="inline-flex items-center gap-2 sm:justify-end">
              <ClockIcon className="shrink-0 text-brand" />
              {formatRelativeDate(match.scheduledAt, locale)}
            </span>
          )}
        </div>

        {match.status === "PENDING" && match.userTeamIds.length > 0 && (
          <div className="mt-4 rounded-xl border border-brand/20 bg-brand/5 p-3.5">
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                <SignInIcon weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">
                  {t("myMatches.checkIn.title")}
                </p>
                <p className="mt-1 text-xs leading-5 text-ink-muted">
                  {t("myMatches.checkIn.description")}
                </p>

                <div className="mt-3" aria-live="polite">
                  {captainCheckIn ? (
                    <p className="inline-flex items-center gap-1.5 text-xs font-bold text-approved">
                      <CheckCircleIcon weight="fill" />
                      {t("myMatches.checkIn.success")}
                    </p>
                  ) : !captainTeamId ? (
                    <p className="text-xs font-semibold text-ink-muted">
                      {t("myMatches.checkIn.captainOnly")}
                    </p>
                  ) : !match.checkInWindow ? (
                    <p className="text-xs font-semibold text-ink-muted">
                      {t("myMatches.checkIn.unscheduled")}
                    </p>
                  ) : now > 0 && opensAt !== null && now < opensAt ? (
                    <p className="text-xs font-semibold text-ink-muted">
                      {t("myMatches.checkIn.opensAt")} {" "}
                      {formatLocalizedDate(
                        match.checkInWindow.opensAt,
                        locale,
                        { dateStyle: "medium", timeStyle: "short" },
                      )}
                    </p>
                  ) : now > 0 && closesAt !== null && now > closesAt ? (
                    <p className="text-xs font-semibold text-rejected">
                      {t("myMatches.checkIn.closed")}
                    </p>
                  ) : checkInOpen ? (
                    <button
                      type="button"
                      disabled={checkingInKey === checkInKey}
                      onClick={() => onCheckIn(match.id, captainTeamId)}
                      className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-on-brand transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <SignInIcon aria-hidden weight="bold" />
                      {t(
                        checkingInKey === checkInKey
                          ? "myMatches.checkIn.checking"
                          : "myMatches.checkIn.action",
                      )}
                    </button>
                  ) : null}

                  {feedback?.matchId === match.id &&
                    feedback.type === "error" && (
                      <p className="mt-2 text-xs font-semibold text-rejected">
                        {t("myMatches.checkIn.error")}
                      </p>
                    )}
                </div>
              </div>
            </div>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
          <Link
            href={`/tournaments/${encodeURIComponent(tournament.slug)}#competition`}
            className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-xs font-semibold text-ink transition hover:border-brand/60 hover:text-brand"
          >
            {t("myMatches.viewTournament")}
            <ArrowRightIcon aria-hidden />
          </Link>
          {match.discordLink && match.status !== "COMPLETED" && (
            <a
              href={match.discordLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-on-brand transition hover:bg-brand-hover"
            >
              <LinkSimpleIcon aria-hidden />
              {t("myMatches.openRoom")}
            </a>
          )}
        </div>
      </div>
    </article>
  );
}

function MatchesSkeleton() {
  return (
    <div className="grid gap-5 lg:grid-cols-2" aria-hidden>
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-80 animate-pulse rounded-2xl border border-line bg-surface-card"
        />
      ))}
    </div>
  );
}

export default function MyMatchesPage() {
  const router = useRouter();
  const { user, ready } = useAuth();
  const { t } = useLocale();
  const [status, setStatus] = useState<MatchStatus>("PENDING");
  const [page, setPage] = useState(1);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [checkingInKey, setCheckingInKey] = useState<string | null>(null);
  const [checkInFeedback, setCheckInFeedback] = useState<{
    matchId: string;
    type: "success" | "error";
  } | null>(null);
  const [result, setResult] = useState<{
    key: string;
    response: MyMatchesResponse | null;
    error: boolean;
  } | null>(null);
  const requestKey = `${user?.id ?? "guest"}:${status}:${page}:${attempt}`;

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!ready) return;
    if (!user) {
      router.replace(
        `/login?returnTo=${encodeURIComponent("/users/me/matches")}`,
      );
      return;
    }
    let cancelled = false;
    matchesApi
      .findMine({ status, page, limit: PAGE_SIZE })
      .then((response) => {
        if (!cancelled) setResult({ key: requestKey, response, error: false });
      })
      .catch(() => {
        if (!cancelled)
          setResult({ key: requestKey, response: null, error: true });
      });
    return () => {
      cancelled = true;
    };
  }, [page, ready, requestKey, router, status, user]);

  const handleCheckIn = async (matchId: string, teamId: string) => {
    const key = `${matchId}:${teamId}`;
    setCheckingInKey(key);
    setCheckInFeedback(null);
    try {
      const checkIn = await matchesApi.checkIn(matchId, teamId);
      const withCheckIn = (match: MyMatch): MyMatch =>
        match.id === matchId
          ? {
              ...match,
              checkIns: [
                ...match.checkIns.filter((item) => item.teamId !== teamId),
                checkIn,
              ],
            }
          : match;
      setResult((current) => {
        if (!current?.response) return current;
        return {
          ...current,
          response: {
            ...current.response,
            data: current.response.data.map(withCheckIn),
            nextMatch: current.response.nextMatch
              ? withCheckIn(current.response.nextMatch)
              : null,
          },
        };
      });
      setCheckInFeedback({ matchId, type: "success" });
    } catch {
      setCheckInFeedback({ matchId, type: "error" });
    } finally {
      setCheckingInKey(null);
    }
  };

  if (!ready || (user && !result)) {
    return (
      <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
        <MatchesSkeleton />
      </div>
    );
  }
  if (!user) return null;

  const loading = result?.key !== requestKey;
  const response = result?.response;
  const matches = response?.data ?? [];

  return (
    <div className="w-full flex-1">
      <title>{`${t("pageTitle.myMatches")} | ArenaVerse`}</title>
      <header className="border-b border-line bg-[image:var(--gradient-hero)]">
        <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-14">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-brand">
            {t("myMatches.eyebrow")}
          </p>
          <div className="mt-2 flex flex-wrap items-end justify-between gap-5">
            <div className="max-w-2xl">
              <h1 className="flex items-center gap-3 text-3xl font-black tracking-tight text-ink sm:text-4xl">
                <CalendarDotsIcon
                  className="shrink-0 text-brand"
                  weight="duotone"
                />
                {t("myMatches.title")}
              </h1>
              <p className="mt-3 text-sm leading-6 text-ink-muted sm:text-base">
                {t("myMatches.description")}
              </p>
            </div>
            <Link href="/users/me/teams" className={secondaryButtonClass}>
              {t("myTeams.title")}
              <ArrowRightIcon aria-hidden />
            </Link>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        {response?.nextMatch && (
          <section aria-labelledby="next-match-heading" className="mb-9">
            <div className="mb-4 flex items-center gap-3">
              <span className="grid size-10 place-items-center rounded-xl bg-brand/10 text-brand">
                <TrophyIcon weight="duotone" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">
                  {t("myMatches.nextEyebrow")}
                </p>
                <h2
                  id="next-match-heading"
                  className="text-xl font-black text-ink"
                >
                  {t("myMatches.nextTitle")}
                </h2>
              </div>
            </div>
            <div className="max-w-2xl">
              <MatchCard
                match={response.nextMatch}
                featured
                now={now}
                checkingInKey={checkingInKey}
                feedback={checkInFeedback}
                onCheckIn={handleCheckIn}
              />
            </div>
          </section>
        )}

        <section aria-labelledby="match-list-heading">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">
                {t("myMatches.scheduleEyebrow")}
              </p>
              <h2
                id="match-list-heading"
                className="mt-1 text-2xl font-black text-ink"
              >
                {t("myMatches.scheduleTitle")}
              </h2>
            </div>
            {response && (
              <p className="text-sm text-ink-muted">
                {response.summary.total} {t("myMatches.totalMatches")}
              </p>
            )}
          </div>

          <div
            role="tablist"
            aria-label={t("myMatches.filters")}
            className="mt-5 flex flex-wrap gap-2"
          >
            {STATUS_TABS.map((tab) => {
              const active = status === tab.status;
              const count = response?.summary[tab.summaryKey];
              return (
                <button
                  key={tab.status}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setStatus(tab.status);
                    setPage(1);
                  }}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-lg border px-4 py-2 text-sm font-semibold transition ${
                    active
                      ? "border-brand bg-brand text-on-brand"
                      : "border-line bg-surface-card text-ink-muted hover:border-brand/50 hover:text-ink"
                  }`}
                >
                  {t(tab.label)}
                  {count !== undefined && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs ${
                        active ? "bg-white/15" : "bg-surface-sub"
                      }`}
                    >
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <div className="mt-6" role="tabpanel" aria-live="polite">
            {loading ? (
              <MatchesSkeleton />
            ) : result?.error ? (
              <div className="rounded-2xl border border-rejected/30 bg-rejected/5 px-6 py-12 text-center">
                <p role="alert" className={alertErrorClass}>
                  {t("myMatches.loadError")}
                </p>
                <button
                  type="button"
                  onClick={() => setAttempt((value) => value + 1)}
                  className={`${secondaryButtonClass} mt-5`}
                >
                  {t("common.retry")}
                </button>
              </div>
            ) : matches.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-line px-6 py-16 text-center">
                <CalendarBlankIcon
                  size={38}
                  className="mx-auto text-brand"
                  weight="duotone"
                />
                <p className="mt-4 font-bold text-ink">
                  {t(`myMatches.empty.${status}`)}
                </p>
                <p className="mx-auto mt-2 max-w-lg text-sm text-ink-muted">
                  {t("myMatches.emptyHint")}
                </p>
                <Link
                  href="/tournaments"
                  className={`${secondaryButtonClass} mt-5`}
                >
                  {t("myMatches.browse")}
                </Link>
              </div>
            ) : (
              <div className="grid gap-5 lg:grid-cols-2">
                {matches.map((match) => (
                  <MatchCard
                    key={match.id}
                    match={match}
                    now={now}
                    checkingInKey={checkingInKey}
                    feedback={checkInFeedback}
                    onCheckIn={handleCheckIn}
                  />
                ))}
              </div>
            )}
          </div>

          {response && response.pagination.totalPages > 1 && (
            <nav
              aria-label={t("myMatches.pagination")}
              className="mt-7 flex items-center justify-center gap-3"
            >
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((value) => Math.max(1, value - 1))}
                className={secondaryButtonClass}
              >
                <CaretLeftIcon aria-hidden />
                {t("common.previous")}
              </button>
              <span className="text-sm font-semibold text-ink-muted">
                {page}/{response.pagination.totalPages}
              </span>
              <button
                type="button"
                disabled={page >= response.pagination.totalPages || loading}
                onClick={() => setPage((value) => value + 1)}
                className={secondaryButtonClass}
              >
                {t("common.next")}
                <CaretRightIcon aria-hidden />
              </button>
            </nav>
          )}
        </section>
      </main>
    </div>
  );
}
