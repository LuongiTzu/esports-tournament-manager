"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowClockwiseIcon,
  ArrowRightIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  ListChecksIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { alertErrorClass } from "@/components/ui";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { teamsApi } from "@/features/teams/api";
import type { TeamWithMembers } from "@/features/teams/types";
import { tournamentsApi } from "@/features/tournaments/api";
import type {
  TournamentDetail,
  TournamentSchedule,
} from "@/features/tournaments/types";

interface ChecklistItem {
  actionHref: string;
  actionLabel: TranslationKey;
  detail: string;
  done: boolean;
  label: TranslationKey;
}

export default function TournamentReadinessChecklist({
  tournament,
}: {
  tournament: TournamentDetail;
}) {
  const { t } = useLocale();
  const [teams, setTeams] = useState<TeamWithMembers[] | null>(null);
  const [schedule, setSchedule] = useState<TournamentSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retryVersion, setRetryVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      teamsApi.findByTournament(tournament.slug, "ALL"),
      tournamentsApi.getSchedule(tournament.slug),
    ])
      .then(([teamResult, scheduleResult]) => {
        if (cancelled) return;
        setTeams(teamResult);
        setSchedule(scheduleResult);
        setError("");
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error
            ? reason.message
            : t("readiness.loadError"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [retryVersion, t, tournament, tournament.slug]);

  const items = useMemo<ChecklistItem[]>(() => {
    const approvedCount =
      teams?.filter((team) => team.status === "APPROVED").length ?? 0;
    const pendingCount =
      teams?.filter((team) => team.status === "PENDING").length ?? 0;
    const firstRoundMatches =
      schedule?.rounds[0]?.dates.flatMap((group) => group.matches) ?? [];
    const playableMatches = firstRoundMatches.filter(
      (match) =>
        match.isActive &&
        !match.isBye &&
        match.teamA !== null &&
        match.teamB !== null,
    );
    const unscheduledCount = playableMatches.filter(
      (match) => !match.scheduledAt,
    ).length;

    return [
      {
        label: "readiness.approvedTeams",
        detail: `${approvedCount} ${t("readiness.approvedTeamsCount")}`,
        done: approvedCount >= 2,
        actionHref: "#registration-management",
        actionLabel: "readiness.reviewTeams",
      },
      {
        label: "readiness.pendingRegistrations",
        detail:
          pendingCount === 0
            ? t("readiness.noPendingRegistrations")
            : `${pendingCount} ${t("readiness.pendingTeamsCount")}`,
        done: pendingCount === 0,
        actionHref: "#registration-management",
        actionLabel: "readiness.reviewTeams",
      },
      {
        label: "readiness.registrationClosed",
        detail: t(
          tournament.registrationOpen
            ? "readiness.registrationStillOpen"
            : "readiness.registrationIsClosed",
        ),
        done: !tournament.registrationOpen,
        actionHref: "#lifecycle-controls",
        actionLabel: "readiness.manageLifecycle",
      },
      {
        label: "readiness.structureGenerated",
        detail:
          firstRoundMatches.length > 0
            ? `${firstRoundMatches.length} ${t("readiness.matchesGenerated")}`
            : t("readiness.structureMissing"),
        done: firstRoundMatches.length > 0,
        actionHref: "#competition-management",
        actionLabel: "readiness.manageCompetition",
      },
      {
        label: "readiness.firstRoundScheduled",
        detail:
          playableMatches.length === 0
            ? t("readiness.noPlayableMatches")
            : unscheduledCount === 0
              ? `${playableMatches.length} ${t("readiness.matchesScheduled")}`
              : `${unscheduledCount}/${playableMatches.length} ${t("readiness.matchesUnscheduled")}`,
        done: playableMatches.length > 0 && unscheduledCount === 0,
        actionHref: "#competition-management",
        actionLabel: "readiness.manageCompetition",
      },
    ];
  }, [schedule, t, teams, tournament.registrationOpen]);

  const completedCount = loading
    ? 0
    : items.filter((item) => item.done).length;
  const ready = !loading && completedCount === items.length;

  return (
    <section
      aria-labelledby="readiness-heading"
      className="overflow-hidden rounded-2xl border border-line bg-surface-card"
    >
      <div className="flex flex-wrap items-start justify-between gap-4 px-4 py-4 sm:px-5">
        <div className="min-w-0">
          <h2
            id="readiness-heading"
            className="flex items-center gap-2 font-bold text-ink"
          >
            <ListChecksIcon size={20} className="text-brand-hover" />
            {t("readiness.title")}
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-ink-muted">
            {t("readiness.description")}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setError("");
            setRetryVersion((value) => value + 1);
          }}
          disabled={loading}
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-line-strong px-3 py-2 text-xs font-semibold text-ink transition hover:bg-surface-hover disabled:opacity-50"
        >
          {loading ? (
            <CircleNotchIcon className="animate-spin" aria-hidden />
          ) : (
            <ArrowClockwiseIcon aria-hidden />
          )}
          {t("readiness.refresh")}
        </button>
      </div>

      {error ? (
        <div className="border-t border-line p-4 sm:p-5">
          <p className={alertErrorClass}>{error}</p>
        </div>
      ) : (
        <>
          <div className="border-y border-line bg-surface-sub/60 px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between gap-4 text-xs font-semibold">
              <span className={ready ? "text-approved" : "text-ink-muted"}>
                {loading
                  ? t("readiness.checking")
                  : ready
                    ? t("readiness.ready")
                    : t("readiness.needsAttention")}
              </span>
              <span className="text-ink-muted">
                {completedCount}/{items.length}
              </span>
            </div>
            <div
              className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"
              role="progressbar"
              aria-label={t("readiness.progress")}
              aria-valuemin={0}
              aria-valuemax={items.length}
              aria-valuenow={completedCount}
            >
              <span
                className={`block h-full rounded-full transition-[width] ${ready ? "bg-approved" : "bg-brand"}`}
                style={{ width: `${(completedCount / items.length) * 100}%` }}
              />
            </div>
          </div>

          <ul className={loading ? "animate-pulse opacity-60" : ""}>
            {items.map((item, index) => (
              <li
                key={item.label}
                className={`flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:px-5 ${
                  index > 0 ? "border-t border-line" : ""
                }`}
              >
                <span
                  className={`grid size-9 shrink-0 place-items-center rounded-full ${
                    item.done && !loading
                      ? "bg-approved/12 text-approved"
                      : "bg-pending/12 text-pending"
                  }`}
                >
                  {item.done && !loading ? (
                    <CheckCircleIcon weight="fill" aria-hidden />
                  ) : (
                    <WarningCircleIcon weight="fill" aria-hidden />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">
                    {t(item.label)}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-muted">{item.detail}</p>
                </div>
                {!item.done && !loading && (
                  <a
                    href={item.actionHref}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-semibold text-brand transition hover:bg-brand/10"
                  >
                    {t(item.actionLabel)}
                    <ArrowRightIcon aria-hidden />
                  </a>
                )}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
