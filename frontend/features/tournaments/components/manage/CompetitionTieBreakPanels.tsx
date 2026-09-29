"use client";

import {
  ArrowRightIcon,
  CircleNotchIcon,
  TrophyIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { primaryButtonClass } from "@/components/ui";
import { useLocale } from "@/features/locale/store";
import type {
  ChampionshipTieBreakDetails,
  QualificationTieBreakDetails,
} from "@/features/tournaments/types";

export default function CompetitionTieBreakPanels({
  tieBreakDecision,
  selectedTieTeamIds,
  tieBreakSelectionComplete,
  championshipTieBreak,
  selectedChampionTeamId,
  loading,
  working,
  onToggleTieBreakTeam,
  onConfirmTieBreak,
  onSelectChampion,
  onFinalizeStandings,
}: {
  tieBreakDecision: QualificationTieBreakDetails | null;
  selectedTieTeamIds: string[];
  tieBreakSelectionComplete: boolean;
  championshipTieBreak: ChampionshipTieBreakDetails | null;
  selectedChampionTeamId: string;
  loading: boolean;
  working: string | null;
  onToggleTieBreakTeam: (teamId: string, tieBreakIndex: number) => void;
  onConfirmTieBreak: () => void;
  onSelectChampion: (teamId: string) => void;
  onFinalizeStandings: (teamId: string) => void;
}) {
  const { t } = useLocale();

  return (
    <>
      {tieBreakDecision && (
        <div className="mt-4 rounded-xl border border-pending/35 bg-pending/10 p-4">
          <div className="flex items-start gap-2">
            <WarningCircleIcon className="mt-0.5 shrink-0 text-pending" />
            <div>
              <h4 className="font-semibold text-ink">
                {t("competition.manage.tieBreakTitle")}
              </h4>
              <p className="mt-1 text-sm text-ink-muted">
                {t("competition.manage.tieBreakDescription")}
              </p>
            </div>
          </div>
      
          {tieBreakDecision.fixedQualifiedTeams.length > 0 && (
            <p className="mt-3 text-xs text-ink-muted">
              {t("competition.manage.fixedQualified")}:{" "}
              <strong className="text-ink">
                {tieBreakDecision.fixedQualifiedTeams
                  .map((team) => team.name)
                  .join(", ")}
              </strong>
            </p>
          )}
      
          <div className="mt-4 space-y-4">
            {tieBreakDecision.tieBreaks.map((tieBreak, tieBreakIndex) => {
              const candidateIds = new Set(
                tieBreak.candidates.map((candidate) => candidate.teamId),
              );
              const selectedCount = selectedTieTeamIds.filter((teamId) =>
                candidateIds.has(teamId),
              ).length;
              return (
                <fieldset
                  key={tieBreak.groupId ?? `round-${tieBreakIndex}`}
                  className="rounded-lg border border-line bg-surface-card p-3"
                >
                  <legend className="px-1 text-sm font-semibold text-ink">
                    {tieBreak.groupName ??
                      t("competition.manage.overallStandings")}
                  </legend>
                  <p className="mb-3 text-xs text-ink-muted">
                    {t("competition.manage.selectTieTeams")}{" "}
                    {tieBreak.requiredSelections} {"·"} {selectedCount}/
                    {tieBreak.requiredSelections}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {tieBreak.candidates.map((candidate) => {
                      const checked = selectedTieTeamIds.includes(
                        candidate.teamId,
                      );
                      const disabled =
                        !checked &&
                        selectedCount >= tieBreak.requiredSelections;
                      return (
                        <label
                          key={candidate.teamId}
                          className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                            checked
                              ? "border-brand bg-brand/10 text-ink"
                              : "border-line bg-surface text-ink-muted"
                          } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            disabled={disabled || Boolean(working)}
                            onChange={() =>
                              onToggleTieBreakTeam(
                                candidate.teamId,
                                tieBreakIndex,
                              )
                            }
                            className="size-4 accent-brand"
                          />
                          <span className="font-medium">
                            {candidate.name}
                          </span>
                          {candidate.seed !== null && (
                            <span className="ml-auto text-xs text-ink-faint">
                              Seed {candidate.seed}
                            </span>
                          )}
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })}
          </div>
      
          <button
            type="button"
            onClick={onConfirmTieBreak}
            disabled={!tieBreakSelectionComplete || Boolean(working)}
            className={`${primaryButtonClass} mt-4`}
          >
            {working === "advance" ? (
              <CircleNotchIcon
                aria-hidden="true"
                className="motion-safe:animate-spin"
              />
            ) : (
              <ArrowRightIcon weight="bold" />
            )}
            {t("competition.manage.confirmTieBreak")}
          </button>
        </div>
      )}
      
      {championshipTieBreak && (
        <fieldset className="mt-4 rounded-xl border border-pending/35 bg-pending/10 p-4">
          <legend className="px-1 font-semibold text-ink">
            {t("competition.manage.championTieTitle")}
          </legend>
          <p className="mt-1 text-sm text-ink-muted">
            {t("competition.manage.championTieDescription")}
          </p>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {championshipTieBreak.candidates.map((candidate) => (
              <label
                key={candidate.teamId}
                className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                  selectedChampionTeamId === candidate.teamId
                    ? "border-brand bg-brand/10 text-ink"
                    : "border-line bg-surface-card text-ink-muted"
                }`}
              >
                <input
                  type="radio"
                  name="championTeamId"
                  value={candidate.teamId}
                  checked={selectedChampionTeamId === candidate.teamId}
                  disabled={Boolean(working) || loading}
                  onChange={() =>
                    onSelectChampion(candidate.teamId)
                  }
                  className="size-4 accent-brand"
                />
                <span className="font-medium">{candidate.name}</span>
                {candidate.seed !== null && (
                  <span className="ml-auto text-xs text-ink-faint">
                    Seed {candidate.seed}
                  </span>
                )}
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={!selectedChampionTeamId || Boolean(working)}
            onClick={() => onFinalizeStandings(selectedChampionTeamId)}
            className={`${primaryButtonClass} mt-4`}
          >
            {working === "finalize" ? (
              <CircleNotchIcon
                aria-hidden="true"
                className="motion-safe:animate-spin"
              />
            ) : (
              <TrophyIcon weight="fill" />
            )}
            {t("competition.manage.confirmChampion")}
          </button>
        </fieldset>
      )}
      
    </>
  );
}
