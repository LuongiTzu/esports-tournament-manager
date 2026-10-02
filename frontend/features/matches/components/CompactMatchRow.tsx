"use client";

import { useState, type ReactNode } from "react";
import { CaretDownIcon } from "@phosphor-icons/react";
import { useLocale } from "@/features/locale/store";
import { formatLocalizedDate } from "@/features/locale/format";
import type { MyMatch } from "../types";

export default function CompactMatchRow({
  match,
  now,
  children,
}: {
  match: MyMatch;
  now: number;
  children: ReactNode;
}) {
  const { t, locale } = useLocale();
  const [open, setOpen] = useState(false);
  const date =
    match.status === "COMPLETED"
      ? (match.playedAt ?? match.scheduledAt)
      : match.scheduledAt;
  const ownTeams = [match.teamA, match.teamB].filter(
    (team) => team && match.userTeamIds.includes(team.id),
  );
  const result =
    match.status !== "COMPLETED" || ownTeams.length !== 1
      ? null
      : match.outcome === "DRAW"
        ? "draw"
        : match.winner
          ? match.userTeamIds.includes(match.winner.id)
            ? "win"
            : "loss"
          : null;
  const canConfirm =
    match.resultReview?.status === "PENDING_CONFIRMATION" &&
    match.captainTeamIds.some(
      (id) =>
        !match.resultReview?.responses.some(
          (response) => response.teamId === id,
        ),
    );
  const canCheckIn =
    match.status === "PENDING" &&
    match.checkInWindow &&
    now >= Date.parse(match.checkInWindow.opensAt) &&
    now <= Date.parse(match.checkInWindow.closesAt) &&
    match.captainTeamIds.some(
      (id) => !match.checkIns.some((checkIn) => checkIn.teamId === id),
    );
  const review = match.resultReview?.status;
  return (
    <div className="border-t border-line first:border-t-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="grid w-full gap-3 px-4 py-4 text-left transition hover:bg-surface-sub/60 focus-visible:outline-2 focus-visible:outline-brand sm:px-5 lg:grid-cols-[10rem_minmax(0,1fr)_auto] lg:items-center"
      >
        <span className="text-xs text-ink-muted">
          <time
            dateTime={date ?? undefined}
            className="block font-semibold text-ink"
          >
            {date
              ? formatLocalizedDate(date, locale, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : t("myMatches.unscheduled")}
          </time>
          <span className="mt-1 block">
            {match.round.name} · BO{match.bestOf}
            {match.matchNumber ? ` · #${match.matchNumber}` : ""}
          </span>
        </span>
        <span className="grid w-full min-w-0 max-w-xl grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center justify-self-center gap-3 sm:gap-4">
          {[match.teamA, match.teamB].map((team, index) => (
            <span key={index} className="contents">
              {index === 1 && (
                <span className="rounded-lg bg-surface-sub px-3 py-2 text-base font-black tabular-nums text-ink">
                  {match.status === "PENDING"
                    ? "VS"
                    : `${match.scoreA} – ${match.scoreB}`}
                </span>
              )}
              <span
                className={`min-w-0 text-sm font-bold ${index ? "text-left" : "text-right"} ${team && match.winner?.id === team.id ? "text-approved" : "text-ink"}`}
              >
                <span className="block break-words">
                  {team?.name ?? t("match.awaitingTeam")}
                </span>
                {team && match.userTeamIds.includes(team.id) && (
                  <span className="mt-1 block text-[11px] font-semibold text-brand-hover">
                    {t("myMatches.yourTeam")}
                  </span>
                )}
              </span>
            </span>
          ))}
        </span>
        <span className="flex flex-wrap items-center gap-2 text-[11px] font-semibold lg:max-w-52 lg:justify-end">
          {result && (
            <span
              className={`rounded-full border px-2 py-1 ${result === "win" ? "border-approved/30 text-approved" : result === "loss" ? "border-rejected/30 text-rejected" : "border-line text-ink-muted"}`}
            >
              {t(`myMatches.compact.${result}`)}
            </span>
          )}
          {canCheckIn && (
            <span className="rounded-full bg-pending/10 px-2 py-1 text-pending">
              {t("myMatches.compact.checkIn")}
            </span>
          )}
          {review && (
            <span
              className={`rounded-full px-2 py-1 ${review === "DISPUTED" ? "bg-rejected/10 text-rejected" : canConfirm ? "bg-pending/10 text-pending" : "bg-surface-sub text-ink-muted"}`}
            >
              {canConfirm
                ? t("myMatches.compact.confirm")
                : t(`myMatches.resultReview.status.${review}`)}
            </span>
          )}
          <span className="ml-auto inline-flex items-center gap-1 text-ink-muted lg:ml-0">
            {t(open ? "myMatches.compact.close" : "myMatches.compact.open")}
            <CaretDownIcon aria-hidden className={open ? "rotate-180" : ""} />
          </span>
        </span>
      </button>
      {open && (
        <div className="border-t border-line bg-surface/50 p-3 sm:p-5">
          {children}
        </div>
      )}
    </div>
  );
}
