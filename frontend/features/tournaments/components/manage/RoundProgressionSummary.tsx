"use client";

import {
  ArrowDownIcon,
  CheckCircleIcon,
  UsersIcon,
} from "@phosphor-icons/react/dist/ssr";
import { roundFormatLabel } from "@/features/tournaments/round-formats";
import type { RoundStandings } from "@/features/tournaments/types";
import { useLocale, type TranslationKey } from "@/features/locale/store";

export default function RoundProgressionSummary({
  data,
}: {
  data: RoundStandings;
}) {
  const { t } = useLocale();
  const { progress, advancement } = data;
  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-stretch">
      <div className="rounded-xl border border-line bg-surface-sub p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
          {t("progress.stageProgress")}
        </p>
        <p className="mt-2 text-lg font-bold text-ink">
          {progress.completedRequiredMatches} / {progress.requiredMatches}{" "}
          {t("progress.requiredMatchesCompleted")}
        </p>
        {progress.totalMatches !== progress.requiredMatches && (
          <p className="mt-1 text-xs text-ink-faint">
            {progress.totalMatches} {t("progress.structureMatches")}
          </p>
        )}
        <p className="mt-1 text-sm text-ink-muted">
          {t(`progress.${advancement.state}` as TranslationKey)}
        </p>
        {advancement.readinessReason && (
          <p className="mt-2 text-xs leading-relaxed text-ink-faint">
            {advancement.readinessReason}
          </p>
        )}
        {data.swissProgress && (
          <div className="mt-3 border-t border-line pt-3">
            <p className="text-sm font-semibold text-ink">
              {t("swiss.iterationProgress")}{" "}
              {data.swissProgress.currentIteration}/
              {data.swissProgress.resolvedNumberOfRounds}
            </p>
            <p className="mt-1 text-xs leading-relaxed text-ink-muted">
              {data.swissProgress.blockedReason
                ? t(
                    `swiss.blocked.${data.swissProgress.blockedReason}` as TranslationKey,
                  )
                : t("swiss.readyNext")}
            </p>
          </div>
        )}
      </div>

      {advancement.nextRound && (
        <ArrowDownIcon
          className="mx-auto self-center text-brand lg:-rotate-90"
          size={24}
        />
      )}

      {advancement.nextRound ? (
        <div className="rounded-xl border border-brand/30 bg-brand/5 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-brand">
            {t("progress.nextRound")}
          </p>
          <p className="mt-2 font-bold text-ink">
            {advancement.nextRound.name}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {roundFormatLabel(advancement.nextRound.format, t)} ·{" "}
            {advancement.nextRound.participantCount}{" "}
            {t("progress.teamsAssigned")} · {advancement.nextRound.matchCount}{" "}
            {t("progress.matches")}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-line bg-surface-sub p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">
            {t("progress.output")}
          </p>
          <p className="mt-2 text-sm text-ink-muted">
            {t("progress.noNextRound")}
          </p>
        </div>
      )}

      {advancement.qualifiedTeams.length > 0 && (
        <div className="lg:col-span-3 rounded-xl border border-approved/30 bg-approved/5 p-4">
          <p className="flex items-center gap-2 text-sm font-semibold text-approved">
            <CheckCircleIcon weight="fill" />{" "}
            {advancement.qualifiedTeams.length} {t("progress.teamsConfirmed")}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {advancement.qualifiedTeams.map(({ team }) => (
              <span
                key={team.id}
                className="rounded-full border border-approved/30 bg-surface-card px-3 py-1 text-xs font-medium text-ink"
              >
                {team.name}
              </span>
            ))}
          </div>
        </div>
      )}

      {data.participants.length > 0 && (
        <div className="lg:col-span-3 rounded-xl border border-line px-4 py-3 text-sm text-ink-muted">
          <div className="flex items-start gap-3">
            <UsersIcon className="mt-0.5 shrink-0 text-brand" />
            <span>
              {t("progress.thisStageHas")}{" "}
              <strong className="text-ink">
                {data.participants.length}{" "}
                {t("standings.team").toLocaleLowerCase()}
              </strong>{" "}
              {t("progress.assigned")}
              {data.participants.some((item) => item.advancedFromRound)
                ? ` ${t("progress.fromPrevious")}`
                : "."}
            </span>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {[...data.participants]
              .sort(
                (left, right) =>
                  (left.seed ?? left.team.seed ?? Number.MAX_SAFE_INTEGER) -
                  (right.seed ?? right.team.seed ?? Number.MAX_SAFE_INTEGER),
              )
              .map((participant) => (
                <span
                  key={participant.team.id}
                  className="rounded-lg border border-line bg-surface-sub px-3 py-2 text-xs text-ink-muted"
                >
                  <strong className="text-ink">
                    #{participant.seed ?? participant.team.seed ?? "–"}{" "}
                    {participant.team.name}
                  </strong>
                  {participant.advancedFromRound && (
                    <span className="ml-1 text-ink-faint">
                      · {t("progress.qualifiedFrom")}{" "}
                      {participant.advancedFromRound.name}
                    </span>
                  )}
                </span>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
