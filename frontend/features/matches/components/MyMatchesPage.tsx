"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRightIcon,
  CalendarBlankIcon,
  CaretLeftIcon,
  CaretRightIcon,
  CaretDownIcon,
  FunnelSimpleIcon,
  CheckCircleIcon,
  ClockIcon,
  LinkSimpleIcon,
  SignInIcon,
  TrophyIcon,
  UsersThreeIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import GameIcon from "@/features/games/components/GameIcon";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import { useAuth } from "@/features/auth/store";
import { gamePoster } from "@/features/games/game-posters";
import { matchesApi, type MyMatchFilters } from "@/features/matches/api";
import {
  getMyCheckInState,
  pickPriorityMatch,
} from "@/features/matches/check-in-state";
import MyMatchFilterBar from "./MyMatchFilterBar";
import CompactMatchRow from "./CompactMatchRow";
import styles from "./MyMatchesPage.module.css";
import type {
  MyMatch,
  MyMatchesResponse,
  RespondToMatchResultRequest,
} from "@/features/matches/types";
import MatchResultReviewPanel from "./MatchResultReviewPanel";
import {
  formatLocalizedDate,
  formatRelativeDate,
} from "@/features/locale/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import type { MatchStatus } from "@/features/tournaments/types";

const PAGE_SIZE = 12;

async function loadPriorityCheckInMatches() {
  const [open, overdue] = await Promise.allSettled([
    matchesApi.findMine({
      status: "PENDING",
      attention: "CHECK_IN",
      page: 1,
      limit: 1,
    }),
    matchesApi.findMine({
      status: "PENDING",
      attention: "OVERDUE_CHECK_IN",
      sort: "NEWEST",
      page: 1,
      limit: 1,
    }),
  ]);
  return {
    open: open.status === "fulfilled" ? open.value.data[0] ?? null : null,
    overdue:
      overdue.status === "fulfilled" ? overdue.value.data[0] ?? null : null,
  };
}

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
  resultResponseKey,
  resultFeedback,
  onResultResponse,
}: {
  match: MyMatch;
  featured?: boolean;
  now: number;
  checkingInKey: string | null;
  feedback: { matchId: string; type: "success" | "error" } | null;
  onCheckIn: (matchId: string, teamId: string) => void;
  resultResponseKey: string | null;
  resultFeedback: { matchId: string; type: "success" | "error" } | null;
  onResultResponse: (
    matchId: string,
    data: RespondToMatchResultRequest,
  ) => Promise<boolean>;
}) {
  const { locale, t } = useLocale();
  const tournament = match.round.tournament;
  const poster =
    gamePoster(tournament.game.code) ??
    "/images/tournaments/common/backgrounds/tournament-collage.png";
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
  const checkIn = getMyCheckInState(match, now);
  const checkInKey = checkIn ? `${match.id}:${checkIn.teamId}` : null;
  const checkInWindow = match.checkInWindow;
  const remainingCheckInMs = checkInWindow
    ? Date.parse(checkInWindow.closesAt) - now
    : 0;

  return (
    <article
      className={`relative isolate overflow-hidden rounded-2xl border bg-surface-card shadow-sm ${
        featured ? "border-brand/45 shadow-brand/10" : "border-line"
      }`}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
      >
        <div
          className="absolute inset-0 bg-cover bg-center opacity-75 grayscale"
          style={{ backgroundImage: `url("${poster}")` }}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,color-mix(in_oklab,var(--color-surface)_85%,transparent),color-mix(in_oklab,var(--color-surface)_88%,transparent)_55%,color-mix(in_oklab,var(--color-surface)_93%,transparent))]" />
      </div>

      <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface-sub/35 px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center overflow-hidden rounded-lg bg-brand/10 text-brand">
            <GameIcon game={tournament.game} size={22} />
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

      <div className="relative z-10 p-4 sm:p-5">
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
                } ${isMine ? "bg-brand/10" : "bg-surface-card/40"}`}
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
          <div
            className={`mt-4 rounded-xl border p-3.5 ${checkIn?.state === "MISSED" ? "border-rejected/30 bg-rejected/5" : checkIn?.state === "OPEN" ? "border-pending/30 bg-pending/5" : "border-brand/20 bg-brand/5"}`}
          >
            <div className="flex items-start gap-3">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand/10 text-brand">
                <SignInIcon weight="duotone" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-ink">
                  {t("myMatches.checkIn.title")}
                </p>
                <p className="mt-1 text-xs leading-5 text-ink-muted">
                  {checkIn?.state === "MISSED"
                    ? t("myMatches.checkIn.missedHint")
                    : t("myMatches.checkIn.description")}
                </p>

                <div className="mt-3" aria-live="polite">
                  {checkIn?.state === "CHECKED_IN" ? (
                    <p className="inline-flex items-center gap-1.5 text-xs font-bold text-approved">
                      <CheckCircleIcon weight="fill" />
                      {t("myMatches.checkIn.success")}
                    </p>
                  ) : checkIn?.state === "UNSCHEDULED" ? (
                    <p className="text-xs font-semibold text-ink-muted">
                      {t("myMatches.checkIn.unscheduled")}
                    </p>
                  ) : checkIn?.state === "OPENS_LATER" && checkInWindow ? (
                    <p className="text-xs font-semibold text-ink-muted">
                      {t("myMatches.checkIn.opensAt")}{" "}
                      {formatLocalizedDate(checkInWindow.opensAt, locale, {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    </p>
                  ) : checkIn?.state === "MISSED" ? (
                    <p className="text-xs font-semibold text-rejected">
                      {t("myMatches.checkIn.missed")}
                    </p>
                  ) : checkIn?.state === "OPEN" && checkInWindow ? (
                    <div className="flex flex-wrap items-center gap-3">
                      {checkIn.canCheckIn ? (
                        <button
                          type="button"
                          disabled={checkingInKey === checkInKey}
                          onClick={() => onCheckIn(match.id, checkIn.teamId)}
                          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2 text-xs font-bold text-on-brand transition hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <SignInIcon aria-hidden weight="bold" />
                          {t(
                            checkingInKey === checkInKey
                              ? "myMatches.checkIn.checking"
                              : "myMatches.checkIn.action",
                          )}
                        </button>
                      ) : (
                        <p className="text-xs font-semibold text-ink-muted">
                          {t("myMatches.checkIn.captainOnly")}
                        </p>
                      )}
                      <p className="text-xs font-semibold text-pending">
                        {remainingCheckInMs < 60_000
                          ? t("myMatches.checkIn.lessThanMinute")
                          : `${t("myMatches.checkIn.timeLeft")} ${Math.ceil(remainingCheckInMs / 60_000)} ${t("myMatches.checkIn.minutes")}`}
                        {" · "}
                        {t("myMatches.checkIn.closesAt")}{" "}
                        {formatLocalizedDate(checkInWindow.closesAt, locale, {
                          timeStyle: "short",
                        })}
                      </p>
                    </div>
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

        <MatchResultReviewPanel
          match={match}
          working={resultResponseKey?.startsWith(`${match.id}:`) ?? false}
          feedback={
            resultFeedback?.matchId === match.id ? resultFeedback.type : null
          }
          onRespond={(data) => onResultResponse(match.id, data)}
        />

        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
          <Link
            href={`/tournaments/${encodeURIComponent(tournament.slug)}/competition`}
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
    <div className="space-y-3" aria-hidden>
      {[0, 1, 2, 3].map((item) => (
        <div
          key={item}
          className="h-28 animate-pulse rounded-2xl border border-line bg-surface-card"
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
  const [filters, setFilters] = useState<MyMatchFilters>({});
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [checkingInKey, setCheckingInKey] = useState<string | null>(null);
  const [checkInFeedback, setCheckInFeedback] = useState<{
    matchId: string;
    type: "success" | "error";
  } | null>(null);
  const [resultResponseKey, setResultResponseKey] = useState<string | null>(
    null,
  );
  const [resultFeedback, setResultFeedback] = useState<{
    matchId: string;
    type: "success" | "error";
  } | null>(null);
  const [result, setResult] = useState<{
    key: string;
    response: MyMatchesResponse | null;
    error: boolean;
  } | null>(null);
  const [priorityMatches, setPriorityMatches] = useState<{
    key: string;
    open: MyMatch | null;
    overdue: MyMatch | null;
  } | null>(null);
  const requestKey = `${user?.id ?? "guest"}:${status}:${page}:${attempt}:${JSON.stringify(filters)}`;
  const priorityKey = `${user?.id ?? "guest"}:${attempt}`;
  const filtered = Object.entries(filters).some(
    ([key, value]) => value && !(key === "sort" && value === "DEFAULT"),
  );
  const filterCount = Object.entries(filters).filter(
    ([key, value]) => value && !(key === "sort" && value === "DEFAULT"),
  ).length;

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
      .findMine({ ...filters, status, page, limit: PAGE_SIZE })
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
  }, [filters, page, ready, requestKey, router, status, user]);

  useEffect(() => {
    if (!ready || !user || status !== "PENDING" || filtered) return;
    let cancelled = false;
    void loadPriorityCheckInMatches().then((matches) => {
      if (!cancelled) {
        setPriorityMatches({ key: priorityKey, ...matches });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, user, status, filtered, priorityKey]);

  useEffect(() => {
    if (!ready || !user || status !== "PENDING") return;
    let cancelled = false;
    const refresh = async () => {
      setNow(Date.now());
      try {
        const response = await matchesApi.findMine({
          ...filters,
          status,
          page,
          limit: PAGE_SIZE,
        });
        if (!cancelled) {
          setResult((current) =>
            current?.key === requestKey
              ? { key: requestKey, response, error: false }
              : current,
          );
        }
      } catch {
        // Keep the last visible schedule; an explicit retry remains available.
      }
      if (!filtered) {
        const matches = await loadPriorityCheckInMatches();
        if (!cancelled) {
          setPriorityMatches({ key: priorityKey, ...matches });
        }
      }
    };
    const onFocus = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    const visibleMatches =
      result?.key === requestKey
        ? [
            ...(result.response?.data ?? []),
            ...(result.response?.nextMatch ? [result.response.nextMatch] : []),
            ...(priorityMatches?.key === priorityKey && priorityMatches.open
              ? [priorityMatches.open]
              : []),
            ...(priorityMatches?.key === priorityKey && priorityMatches.overdue
              ? [priorityMatches.overdue]
              : []),
          ]
        : [];
    const nextBoundary = visibleMatches
      .flatMap((match) =>
        match.checkInWindow
          ? [
              Date.parse(match.checkInWindow.opensAt),
              Date.parse(match.checkInWindow.closesAt) + 1,
            ]
          : [],
      )
      .filter((time) => time > Date.now())
      .sort((a, b) => a - b)[0];
    const boundaryTimer = nextBoundary
      ? window.setTimeout(
          () => void refresh(),
          Math.min(nextBoundary - Date.now(), 2_147_483_647),
        )
      : undefined;
    const interval = window.setInterval(() => void refresh(), 60_000);
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.clearTimeout(boundaryTimer);
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
    };
  }, [ready, user, status, filters, page, filtered, requestKey, priorityKey, result, priorityMatches]);

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
      if (filters.attention || priorityMatches?.open?.id === matchId) {
        setPage(1);
        setAttempt((value) => value + 1);
      }
    } catch {
      setCheckInFeedback({ matchId, type: "error" });
    } finally {
      setCheckingInKey(null);
    }
  };

  const handleResultResponse = async (
    matchId: string,
    data: RespondToMatchResultRequest,
  ) => {
    setResultResponseKey(`${matchId}:${data.teamId}`);
    setResultFeedback(null);
    try {
      const resultReview = await matchesApi.respondToResult(matchId, data);
      const withReview = (match: MyMatch): MyMatch =>
        match.id === matchId ? { ...match, resultReview } : match;
      setResult((current) => {
        if (!current?.response) return current;
        return {
          ...current,
          response: {
            ...current.response,
            data: current.response.data.map(withReview),
            nextMatch: current.response.nextMatch
              ? withReview(current.response.nextMatch)
              : null,
          },
        };
      });
      setResultFeedback({ matchId, type: "success" });
      if (filters.attention) {
        setPage(1);
        setAttempt((value) => value + 1);
      }
      return true;
    } catch {
      setResultFeedback({ matchId, type: "error" });
      return false;
    } finally {
      setResultResponseKey(null);
    }
  };

  if (!ready || (user && !result)) {
    return (
      <div className={`${styles.page} mx-auto w-full max-w-7xl px-4 py-10 sm:px-6`}>
        <MatchesSkeleton />
      </div>
    );
  }
  if (!user) return null;

  const loading = result?.key !== requestKey;
  const response = result?.response;
  const matches = response?.data ?? [];
  const groups = new Map<string, MyMatch[]>();
  for (const match of matches) {
    const id = match.round.tournament.id;
    const group = groups.get(id) ?? [];
    group.push(match);
    groups.set(id, group);
  }
  const priorityMatch =
    status === "PENDING" && !filtered && response
      ? pickPriorityMatch(
          [
            ...response.data,
            ...(response.nextMatch ? [response.nextMatch] : []),
            ...(priorityMatches?.key === priorityKey && priorityMatches.open
              ? [priorityMatches.open]
              : []),
            ...(priorityMatches?.key === priorityKey && priorityMatches.overdue
              ? [priorityMatches.overdue]
              : []),
          ],
          now,
        )
      : null;
  const priorityState = priorityMatch
    ? getMyCheckInState(priorityMatch, now)?.state
    : null;

  const statusTotal =
    response?.summary[
      STATUS_TABS.find((tab) => tab.status === status)!.summaryKey
    ] ?? 0;

  return (
    <div className={`${styles.page} tournament-discovery-page relative w-full flex-1 overflow-x-clip bg-surface`}>
      <title>{`${t("pageTitle.myMatches")} | ArenaVerse`}</title>
      <header className="tournament-discovery-hero relative isolate overflow-hidden border-b border-line">
        <div
          aria-hidden
          className="absolute inset-0 -z-20 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('/images/tournaments/common/backgrounds/tournament-collage.png')",
          }}
        />
        <div
          aria-hidden
          className="tournament-discovery-hero-overlay absolute inset-0 -z-10 bg-[linear-gradient(90deg,color-mix(in_oklab,var(--color-surface)_68%,transparent),color-mix(in_oklab,var(--color-surface)_18%,transparent)_50%,color-mix(in_oklab,var(--color-surface)_68%,transparent)),linear-gradient(0deg,color-mix(in_oklab,var(--color-surface)_78%,transparent),transparent_72%)]"
        />
        <div className="mx-auto grid max-w-7xl items-center gap-4 px-4 py-5 sm:px-6 sm:py-6 lg:grid-cols-[10rem_minmax(0,1fr)_10rem] lg:gap-6 lg:px-8">
          <div className="min-w-0 text-center lg:col-start-2">
            <p className="tournament-discovery-eyebrow text-xs font-extrabold uppercase tracking-[0.3em] text-brand-hover">
              {t("myMatches.eyebrow")}
            </p>
            <h1 className="tournament-discovery-title mt-2 text-balance text-[clamp(1.75rem,3vw,2.35rem)] font-black leading-[1.18] tracking-tight text-ink drop-shadow-[0_3px_14px_rgba(0,0,0,0.85)]">
              {t("myMatches.title")}
            </h1>
            <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-ink-muted sm:text-base">
              {t("myMatches.description")}
            </p>
          </div>
          <Link
            href="/users/me/teams"
            className="inline-flex min-h-12 items-center justify-center gap-2 justify-self-end whitespace-nowrap rounded-[var(--radius-control)] border border-violet-400/60 bg-violet-600 px-4 py-3 text-sm font-bold text-white shadow-[0_6px_24px_rgba(124,58,237,0.25)] transition-colors hover:border-violet-300 hover:bg-violet-700"
          >
            <UsersThreeIcon aria-hidden size={20} weight="bold" className="shrink-0" />
            {t("myTeams.title")}
            <ArrowRightIcon aria-hidden weight="bold" className="shrink-0" />
          </Link>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        {priorityMatch && !loading && (
          <section aria-labelledby="next-match-heading" className="mb-9">
            <div className="mb-4 flex items-center gap-3">
              <span
                className={`grid size-10 place-items-center rounded-xl ${priorityState === "MISSED" ? "bg-rejected/10 text-rejected" : priorityState === "OPEN" ? "bg-pending/10 text-pending" : "bg-brand/10 text-brand"}`}
              >
                {priorityState === "MISSED" ? (
                  <WarningCircleIcon weight="duotone" />
                ) : (
                  <TrophyIcon weight="duotone" />
                )}
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-brand">
                  {t(
                    priorityState === "OPEN" || priorityState === "MISSED"
                      ? "myMatches.priority.eyebrow"
                      : "myMatches.nextEyebrow",
                  )}
                </p>
                <h2
                  id="next-match-heading"
                  className="text-xl font-black text-ink"
                >
                  {t(
                    priorityState === "OPEN"
                      ? "myMatches.priority.open"
                      : priorityState === "MISSED"
                        ? "myMatches.priority.missed"
                        : "myMatches.nextTitle",
                  )}
                </h2>
              </div>
            </div>
            <div className="overflow-hidden rounded-2xl border border-brand/35 bg-surface-card">
              <MatchCard
                match={priorityMatch}
                featured
                now={now}
                checkingInKey={checkingInKey}
                feedback={checkInFeedback}
                onCheckIn={handleCheckIn}
                resultResponseKey={resultResponseKey}
                resultFeedback={resultFeedback}
                onResultResponse={handleResultResponse}
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
                {response.pagination.total} / {statusTotal}{" "}
                {t("myMatches.totalMatches")}
              </p>
            )}
          </div>

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div
              role="tablist"
              aria-label={t("myMatches.filters")}
              className="flex flex-wrap gap-2"
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
                      setFilters((current) => {
                        const attention = current.attention;
                        const appliesHere =
                          !attention ||
                          (tab.status === "PENDING" &&
                            (attention === "NEEDS_ACTION" ||
                              attention === "CHECK_IN" ||
                              attention === "OVERDUE_CHECK_IN")) ||
                          (tab.status === "COMPLETED" &&
                            (attention === "NEEDS_ACTION" ||
                              attention === "CONFIRM" ||
                              attention === "DISPUTED"));
                        return appliesHere
                          ? current
                          : { ...current, attention: undefined };
                      });
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
            <button
              type="button"
              aria-expanded={filtersOpen}
              aria-controls="my-match-filters"
              onClick={() => setFiltersOpen((open) => !open)}
              className={`${secondaryButtonClass} ${filtersOpen || filterCount ? "border-brand/60 text-brand-hover" : ""}`}
            >
              <FunnelSimpleIcon aria-hidden weight="bold" />
              {t("myMatches.filter.toggle")}
              {filterCount > 0 && (
                <span className="rounded-full bg-brand px-2 py-0.5 text-xs text-on-brand">
                  {filterCount}
                </span>
              )}
            </button>
          </div>

          {filtersOpen && (
            <div id="my-match-filters">
              <MyMatchFilterBar
                filters={filters}
                teams={response?.filterTeams ?? []}
                onChange={(next) => {
                  setFilters(next);
                  if (
                    next.attention === "CHECK_IN" ||
                    next.attention === "OVERDUE_CHECK_IN"
                  ) {
                    setStatus("PENDING");
                  } else if (
                    next.attention === "CONFIRM" ||
                    next.attention === "DISPUTED"
                  ) {
                    setStatus("COMPLETED");
                  }
                  setPage(1);
                }}
              />
            </div>
          )}

          <div
            className="mt-6"
            role="tabpanel"
            aria-live="polite"
            aria-busy={loading}
          >
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
                  {filtered
                    ? t("myMatches.filter.noResults")
                    : t(`myMatches.empty.${status}`)}
                </p>
                <p className="mx-auto mt-2 max-w-lg text-sm text-ink-muted">
                  {t(
                    filtered
                      ? "myMatches.filter.noResultsHint"
                      : "myMatches.emptyHint",
                  )}
                </p>
                <Link
                  href="/tournaments"
                  className={`${secondaryButtonClass} mt-5`}
                >
                  {t("myMatches.browse")}
                </Link>
              </div>
            ) : (
              <div className="space-y-5">
                {[...groups].map(([id, group]) => {
                  const tournament = group[0].round.tournament;
                  return (
                    <details
                      key={`${requestKey}:${id}`}
                      open
                      className="group overflow-hidden rounded-2xl border border-line bg-surface-card"
                    >
                      <summary className="flex cursor-pointer list-none items-center gap-3 border-b border-line bg-surface-sub/40 p-4 sm:p-5 [&::-webkit-details-marker]:hidden">
                        <CaretDownIcon
                          aria-hidden
                          className="shrink-0 text-brand-hover transition group-open:rotate-180"
                        />
                        <ResolvedImage
                          src={
                            gamePoster(tournament.game.code) ??
                            gamePoster("CUSTOM")
                          }
                          alt=""
                          className="hidden aspect-video w-24 shrink-0 rounded-lg bg-surface object-contain sm:block"
                          fallback={
                            <GameIcon
                              game={tournament.game}
                              className="text-brand"
                            />
                          }
                        />
                        <div className="min-w-0 flex-1">
                          <h3 className="text-sm font-bold text-ink sm:text-base">
                            {tournament.name}
                          </h3>
                          <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                            <GameIcon game={tournament.game} size={16} />
                            {tournament.displayGameName}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-ink-muted">
                          {group.length} {t("myMatches.filter.onPage")}
                        </span>
                      </summary>
                      {group.map((match) => (
                        <CompactMatchRow key={match.id} match={match} now={now}>
                          <MatchCard
                            key={match.id}
                            match={match}
                            now={now}
                            checkingInKey={checkingInKey}
                            feedback={checkInFeedback}
                            onCheckIn={handleCheckIn}
                            resultResponseKey={resultResponseKey}
                            resultFeedback={resultFeedback}
                            onResultResponse={handleResultResponse}
                          />
                        </CompactMatchRow>
                      ))}
                    </details>
                  );
                })}
              </div>
            )}
          </div>

          {!loading && response && response.pagination.totalPages > 1 && (
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
      </div>
    </div>
  );
}
