"use client";

import type { Dispatch, SetStateAction } from "react";
import { BracketsCurlyIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { hintClass, inputClass, labelClass, secondaryButtonClass } from "@/components/ui";
import { useLocale } from "@/features/locale/store";
import SwissSettingsFields from "@/features/tournaments/components/competition/SwissSettingsFields";
import {
  DoubleEliminationIcon,
  GroupStageIcon,
  RoundRobinIcon,
  SingleEliminationIcon,
  SwissStageIcon,
  type TournamentFormatIcon,
} from "@/features/home/components/TournamentFormatIcons";
import { ROUND_FORMATS, type RoundFormatValue } from "@/features/tournaments/round-formats";
import type { MatchScoringMode } from "@/features/tournaments/types";
import { optionalNumber, type RoundForm } from "./create-form-model";
import TournamentFormSection from "./TournamentFormSection";

const ROUND_FORMAT_ICONS: Record<RoundFormatValue, TournamentFormatIcon> = {
  ROUND_ROBIN: RoundRobinIcon,
  GROUP_STAGE: GroupStageIcon,
  SWISS: SwissStageIcon,
  PLAYOFF: SingleEliminationIcon,
  DOUBLE_ELIM: DoubleEliminationIcon,
};

function RoundFormatMark({ format, index }: { format: RoundFormatValue; index: number }) {
  const FormatIcon = ROUND_FORMAT_ICONS[format];
  return (
    <span className="flex items-center gap-2 self-center text-brand">
      <span className="grid size-10 place-items-center rounded-lg border border-brand/20 bg-brand/10">
        <FormatIcon className="size-6" />
      </span>
      <span className="font-mono text-xs font-bold">{index + 1}</span>
    </span>
  );
}

export default function TournamentRoundsSection({
  rounds,
  maxTeams,
  expandedRoundIndex,
  setExpandedRoundIndex,
  addRound,
  removeRound,
  updateRound,
  updateScoringMode,
  updateRoundRobinSettings,
  updateGroupStageSettings,
  updateSwissSettings,
  updateEliminationSetting,
}: {
  rounds: RoundForm[];
  maxTeams: string;
  expandedRoundIndex: number | null;
  setExpandedRoundIndex: Dispatch<SetStateAction<number | null>>;
  addRound: () => void;
  removeRound: (index: number) => void;
  updateRound: (index: number, field: "name" | "format" | "bestOf", value: string) => void;
  updateScoringMode: (index: number, value: MatchScoringMode) => void;
  updateRoundRobinSettings: (index: number, field: keyof RoundForm["roundRobin"], value: string | boolean) => void;
  updateGroupStageSettings: (index: number, field: keyof RoundForm["groupStage"], value: string | boolean) => void;
  updateSwissSettings: (index: number, field: keyof RoundForm["swiss"], value: string) => void;
  updateEliminationSetting: (index: number, format: "PLAYOFF" | "DOUBLE_ELIM", checked: boolean) => void;
}) {
  const { t } = useLocale();

  return (
    <TournamentFormSection
      id="tournament-rounds"
      Icon={BracketsCurlyIcon}
      title={t("tournament.create.section.rounds")}
      description={t("tournament.create.section.roundsDescription")}
    >
      <div className="flex justify-end">
        <button
          type="button"
          onClick={addRound}
          className={`${secondaryButtonClass} px-3 py-2 text-xs`}
        >
          <PlusIcon size={14} weight="bold" />
          {t("tournament.create.addRound")}
        </button>
      </div>
    
      <div className="mt-4 space-y-3">
        {rounds.map((round, index) => (
          <div
            key={index}
            className="rounded-xl border border-line bg-surface/55 p-4"
          >
            <div className="grid gap-3 sm:grid-cols-[auto_minmax(0,1fr)_10rem_7rem_auto_auto] sm:items-end">
              <RoundFormatMark format={round.format} index={index} />
              <label className={labelClass}>
                {t("tournament.create.roundName")}
                <input
                  type="text"
                  required
                  maxLength={100}
                  value={round.name}
                  onChange={(event) =>
                    updateRound(index, "name", event.target.value)
                  }
                  className={`${inputClass} mt-1 bg-surface`}
                  placeholder={t(
                    "tournament.create.roundNamePlaceholder",
                  )}
                />
              </label>
              <label className={labelClass}>
                {t("round.settings.scoringMode")}
                <select
                  value={round.scoringMode}
                  onChange={(event) =>
                    updateScoringMode(
                      index,
                      event.target.value as MatchScoringMode,
                    )
                  }
                  className={`${inputClass} mt-1 bg-surface`}
                >
                  <option value="SERIES_SCORE">
                    {t("round.settings.scoringMode.SERIES_SCORE")}
                  </option>
                  <option value="POINT_SCORE">
                    {t("round.settings.scoringMode.POINT_SCORE")}
                  </option>
                </select>
              </label>
              <label className={labelClass}>
                {t("round.settings.bestOf")}
                <select
                  value={round.bestOf}
                  disabled={round.scoringMode === "POINT_SCORE"}
                  onChange={(event) =>
                    updateRound(index, "bestOf", event.target.value)
                  }
                  className={`${inputClass} mt-1 bg-surface disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {[1, 3, 5, 7, 9].map((bestOf) => (
                    <option key={bestOf} value={bestOf}>
                      BO{bestOf}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={() =>
                  setExpandedRoundIndex((current) =>
                    current === index ? null : index,
                  )
                }
                className="mb-1 rounded-lg border border-line bg-surface-card px-3 py-2 text-xs font-semibold text-brand transition-colors hover:bg-brand/10"
              >
                {expandedRoundIndex === index
                  ? t("common.close")
                  : t("common.edit")}
              </button>
              {rounds.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeRound(index)}
                  aria-label={`${t("tournament.create.removeRound")} ${index + 1}`}
                  className="mb-1 rounded-lg p-2 text-ink-faint transition hover:bg-rejected/10 hover:text-rejected"
                >
                  <TrashIcon size={17} />
                </button>
              )}
            </div>
    
            <div className="mt-4">
              <p className={labelClass}>
                {t("tournament.create.roundFormat")}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
                {ROUND_FORMATS.map((format) => {
                  const FormatIcon = ROUND_FORMAT_ICONS[format.value];
                  const selected = round.format === format.value;
    
                  return (
                    <button
                      key={format.value}
                      type="button"
                      aria-pressed={selected}
                      onClick={() =>
                        updateRound(index, "format", format.value)
                      }
                      className={`group flex min-h-24 flex-col items-center justify-center border px-3 py-3 text-center transition-[border-color,background-color,color,transform,box-shadow] active:scale-[0.98] ${
                        selected
                          ? "border-brand bg-brand/10 text-brand shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-brand)_22%,transparent)]"
                          : "border-line bg-surface-card text-ink-muted hover:border-brand/45 hover:bg-brand/5 hover:text-ink"
                      }`}
                    >
                      <FormatIcon
                        className={`size-9 transition-transform duration-200 group-hover:scale-105 ${
                          selected ? "text-brand" : "text-ink-faint"
                        }`}
                      />
                      <span className="mt-2 text-xs font-bold leading-4">
                        {t(format.labelKey)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
    
            {expandedRoundIndex === index && (
              <>
                {round.format === "ROUND_ROBIN" && (
                  <div className="mt-4 border-t border-line/70 pt-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
                      {t("tournament.create.roundRobinSettings")}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <label className={labelClass}>
                        {t("tournament.create.advancingTeams")}
                        <input
                          type="number"
                          min={1}
                          max={256}
                          step={1}
                          value={round.roundRobin.advancingTeamCount}
                          onChange={(event) =>
                            updateRoundRobinSettings(
                              index,
                              "advancingTeamCount",
                              event.target.value,
                            )
                          }
                          className={`${inputClass} mt-1 bg-surface`}
                        />
                        <span className={`${hintClass} mt-1 block`}>
                          {t("tournament.create.advancingTeamsHint")}
                        </span>
                      </label>
                      <label className={labelClass}>
                        {t("tournament.create.meetingsPerPair")}
                        <input
                          type="number"
                          min={1}
                          max={4}
                          step={1}
                          value={round.roundRobin.meetingsPerPair}
                          onChange={(event) =>
                            updateRoundRobinSettings(
                              index,
                              "meetingsPerPair",
                              event.target.value,
                            )
                          }
                          className={`${inputClass} mt-1 bg-surface`}
                        />
                        <span className={`${hintClass} mt-1 block`}>
                          {t("tournament.create.meetingsHint")}
                        </span>
                      </label>
                      <label className={labelClass}>
                        {t("tournament.create.winPoints")}
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={round.roundRobin.winPoints}
                          onChange={(event) =>
                            updateRoundRobinSettings(
                              index,
                              "winPoints",
                              event.target.value,
                            )
                          }
                          className={`${inputClass} mt-1 bg-surface`}
                        />
                      </label>
                      <label className={labelClass}>
                        {t("tournament.create.lossPoints")}
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={round.roundRobin.lossPoints}
                          onChange={(event) =>
                            updateRoundRobinSettings(
                              index,
                              "lossPoints",
                              event.target.value,
                            )
                          }
                          className={`${inputClass} mt-1 bg-surface`}
                        />
                      </label>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface/70 px-3 py-2.5 sm:self-start lg:mt-5">
                        <input
                          type="checkbox"
                          checked={round.roundRobin.allowDraws}
                          onChange={(event) =>
                            updateRoundRobinSettings(
                              index,
                              "allowDraws",
                              event.target.checked,
                            )
                          }
                          className="size-4 accent-[var(--color-brand)]"
                        />
                        <span className="text-sm font-semibold text-ink">
                          {t("tournament.create.allowDraws")}
                        </span>
                      </label>
                      <label
                        className={`${labelClass} ${
                          round.roundRobin.allowDraws
                            ? ""
                            : "opacity-50"
                        }`}
                      >
                        {t("tournament.create.drawPoints")}
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          disabled={!round.roundRobin.allowDraws}
                          value={round.roundRobin.drawPoints}
                          onChange={(event) =>
                            updateRoundRobinSettings(
                              index,
                              "drawPoints",
                              event.target.value,
                            )
                          }
                          className={`${inputClass} mt-1 bg-surface disabled:cursor-not-allowed`}
                        />
                      </label>
                    </div>
                  </div>
                )}
                {round.format === "SWISS" && (
                  <div className="mt-4 border-t border-line/70 pt-4">
                    <SwissSettingsFields
                      value={round.swiss}
                      onChange={(key, value) =>
                        updateSwissSettings(index, key, value)
                      }
                    />
                  </div>
                )}
                {round.format === "PLAYOFF" && (
                  <div className="mt-4 border-t border-line/70 pt-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
                      {t("tournament.create.playoffSettings")}
                    </p>
                    <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface/70 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={round.playoff.thirdPlaceMatch}
                        onChange={(event) =>
                          updateEliminationSetting(
                            index,
                            "PLAYOFF",
                            event.target.checked,
                          )
                        }
                        className="mt-0.5 size-4 accent-[var(--color-brand)]"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-ink">
                          {t("tournament.create.thirdPlace")}
                        </span>
                        <span className={`${hintClass} mt-1 block`}>
                          {t("tournament.create.thirdPlaceHint")}
                        </span>
                      </span>
                    </label>
                  </div>
                )}
                {round.format === "DOUBLE_ELIM" && (
                  <div className="mt-4 border-t border-line/70 pt-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
                      {t("tournament.create.doubleElimSettings")}
                    </p>
                    <label className="mt-3 flex cursor-pointer items-start gap-3 rounded-lg border border-line bg-surface/70 px-3 py-3">
                      <input
                        type="checkbox"
                        checked={round.doubleElim.grandFinalReset}
                        onChange={(event) =>
                          updateEliminationSetting(
                            index,
                            "DOUBLE_ELIM",
                            event.target.checked,
                          )
                        }
                        className="mt-0.5 size-4 accent-[var(--color-brand)]"
                      />
                      <span>
                        <span className="block text-sm font-semibold text-ink">
                          {t("round.settings.grandFinalReset")}
                        </span>
                        <span className={`${hintClass} mt-1 block`}>
                          {t("tournament.create.grandFinalResetHint")}
                        </span>
                      </span>
                    </label>
                  </div>
                )}
                {round.format === "GROUP_STAGE" && (
                  <div className="mt-4 border-t border-line/70 pt-4">
                    <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-faint">
                      {t("tournament.create.groupSettings")}
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      <label className={labelClass}>
                        {t("tournament.create.numberOfGroups")}
                        <input
                          type="number"
                          min={2}
                          max={16}
                          step={1}
                          value={round.groupStage.numberOfGroups}
                          onChange={(event) =>
                            updateGroupStageSettings(
                              index,
                              "numberOfGroups",
                              event.target.value,
                            )
                          }
                          className={`${inputClass} mt-1 bg-surface`}
                        />
                      </label>
                      <label className={labelClass}>
                        {t("tournament.create.advancePerGroup")}
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={
                            round.groupStage.advancingTeamsPerGroup
                          }
                          onChange={(event) =>
                            updateGroupStageSettings(
                              index,
                              "advancingTeamsPerGroup",
                              event.target.value,
                            )
                          }
                          className={`${inputClass} mt-1 bg-surface`}
                        />
                      </label>
                      <label className={labelClass}>
                        {t("tournament.create.meetingsPerPair")}
                        <select
                          value={round.groupStage.meetingsPerPair}
                          onChange={(event) =>
                            updateGroupStageSettings(
                              index,
                              "meetingsPerPair",
                              event.target.value,
                            )
                          }
                          className={`${inputClass} mt-1 bg-surface`}
                        >
                          {[1, 2, 3, 4].map((meetings) => (
                            <option key={meetings} value={meetings}>
                              {meetings}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className={labelClass}>
                        {t("tournament.create.winPoints")}
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={round.groupStage.winPoints}
                          onChange={(event) =>
                            updateGroupStageSettings(
                              index,
                              "winPoints",
                              event.target.value,
                            )
                          }
                          className={`${inputClass} mt-1 bg-surface`}
                        />
                      </label>
                      <label className={labelClass}>
                        {t("tournament.create.lossPoints")}
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          value={round.groupStage.lossPoints}
                          onChange={(event) =>
                            updateGroupStageSettings(
                              index,
                              "lossPoints",
                              event.target.value,
                            )
                          }
                          className={`${inputClass} mt-1 bg-surface`}
                        />
                      </label>
                      <label
                        className={`${labelClass} ${
                          round.groupStage.allowDraws
                            ? ""
                            : "opacity-50"
                        }`}
                      >
                        {t("tournament.create.drawPoints")}
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={1}
                          disabled={!round.groupStage.allowDraws}
                          value={round.groupStage.drawPoints}
                          onChange={(event) =>
                            updateGroupStageSettings(
                              index,
                              "drawPoints",
                              event.target.value,
                            )
                          }
                          className={`${inputClass} mt-1 bg-surface disabled:cursor-not-allowed`}
                        />
                      </label>
                      <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-line bg-surface/70 px-3 py-2.5 sm:self-start">
                        <input
                          type="checkbox"
                          checked={round.groupStage.allowDraws}
                          onChange={(event) =>
                            updateGroupStageSettings(
                              index,
                              "allowDraws",
                              event.target.checked,
                            )
                          }
                          className="size-4 accent-[var(--color-brand)]"
                        />
                        <span className="text-sm font-semibold text-ink">
                          {t("tournament.create.allowDraws")}
                        </span>
                      </label>
                    </div>
                    <div className="mt-3 space-y-1 rounded-lg border border-line bg-surface/70 px-3 py-2.5 text-xs text-ink-muted">
                      {(() => {
                        const parsedMaxTeams = optionalNumber(
                          maxTeams,
                        );
                        const numberOfGroups = Number(
                          round.groupStage.numberOfGroups,
                        );
                        const advancingTeamsPerGroup = Number(
                          round.groupStage.advancingTeamsPerGroup,
                        );
                        const hasValidPreview =
                          parsedMaxTeams !== undefined &&
                          Number.isInteger(numberOfGroups) &&
                          numberOfGroups >= 2;
                        const capacityDivides =
                          hasValidPreview &&
                          parsedMaxTeams % numberOfGroups === 0;
                        return (
                          <>
                            {capacityDivides ? (
                              <p>
                                {t(
                                  "tournament.create.estimatedCapacity",
                                )}
                                : {parsedMaxTeams / numberOfGroups}{" "}
                                {t(
                                  "tournament.create.teamsPerGroupEstimated",
                                )}
                              </p>
                            ) : hasValidPreview ? (
                              <p
                                className="text-rejected"
                                role="alert"
                              >
                                {t("tournament.create.maxTeams")}{" "}
                                {parsedMaxTeams}{" "}
                                {t(
                                  "tournament.create.capacityCannotDivide",
                                )}{" "}
                                {numberOfGroups}{" "}
                                {t("tournament.create.groupsUnit")}
                              </p>
                            ) : (
                              <p>
                                {t(
                                  "tournament.create.teamsPerGroupActualHint",
                                )}
                              </p>
                            )}
                            {Number.isInteger(numberOfGroups) &&
                              Number.isInteger(
                                advancingTeamsPerGroup,
                              ) && (
                                <p>
                                  {t("tournament.create.total")}{" "}
                                  {numberOfGroups *
                                    advancingTeamsPerGroup}{" "}
                                  {t(
                                    "tournament.create.advanceNextRound",
                                  )}
                                </p>
                              )}
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </TournamentFormSection>
  );
}
