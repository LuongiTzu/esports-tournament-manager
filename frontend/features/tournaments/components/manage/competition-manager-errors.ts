import type { TranslationKey } from "@/features/locale/store";
import type {
  ChampionshipTieBreakDetails,
  QualificationTieBreakDetails,
} from "@/features/tournaments/types";

export const swissErrorTranslationByCode: Partial<Record<string, TranslationKey>> = {
  TOURNAMENT_NOT_MUTABLE: "swiss.blocked.TOURNAMENT_NOT_MUTABLE",
  ROUND_NOT_MUTABLE: "swiss.blocked.ROUND_NOT_MUTABLE",
  SWISS_ITERATION_NOT_COMPLETE: "swiss.blocked.CURRENT_ITERATION_INCOMPLETE",
  SWISS_ALL_ITERATIONS_COMPLETE: "swiss.blocked.ALL_ITERATIONS_COMPLETE",
  SWISS_STRUCTURE_INVALID: "swiss.blocked.STRUCTURE_INVALID",
};

export const generationErrorTranslationByCode: Partial<
  Record<string, TranslationKey>
> = {
  TOURNAMENT_NOT_MUTABLE: "generation.blocked.TOURNAMENT_NOT_MUTABLE",
  REGISTRATION_MUST_BE_CLOSED: "generation.blocked.REGISTRATION_MUST_BE_CLOSED",
  PREVIOUS_ROUND_NOT_COMPLETE: "generation.blocked.PREVIOUS_ROUND_NOT_COMPLETE",
  ROUND_PARTICIPANTS_NOT_READY:
    "generation.blocked.ROUND_PARTICIPANTS_NOT_READY",
  ROUND_PARTICIPANTS_INELIGIBLE:
    "generation.blocked.ROUND_PARTICIPANTS_INELIGIBLE",
  ROUND_SEQUENCE_INVALID: "generation.blocked.ROUND_SEQUENCE_INVALID",
  ELIMINATION_MUST_BE_TERMINAL:
    "generation.blocked.ELIMINATION_MUST_BE_TERMINAL",
  ROUND_PREVIEW_STALE: "generation.blocked.ROUND_PREVIEW_STALE",
};

export const advancementErrorTranslationByCode: Partial<
  Record<string, TranslationKey>
> = {
  TOURNAMENT_NOT_MUTABLE: "advancement.error.TOURNAMENT_NOT_MUTABLE",
  ROUND_NOT_MUTABLE: "advancement.error.ROUND_NOT_MUTABLE",
  PREVIOUS_ROUND_NOT_COMPLETE: "advancement.error.PREVIOUS_ROUND_NOT_COMPLETE",
  ROUND_ADVANCEMENT_SNAPSHOT_CHANGED:
    "advancement.error.ROUND_ADVANCEMENT_SNAPSHOT_CHANGED",
  ROUND_ADVANCEMENT_ALREADY_PERSISTED:
    "advancement.error.ROUND_ADVANCEMENT_ALREADY_PERSISTED",
  NEXT_ROUND_ALREADY_GENERATED:
    "advancement.error.NEXT_ROUND_ALREADY_GENERATED",
  ROUND_ADVANCEMENT_TARGET_INVALID:
    "advancement.error.ROUND_ADVANCEMENT_TARGET_INVALID",
  ROUND_TIE_BREAK_SELECTION_INVALID:
    "advancement.error.ROUND_TIE_BREAK_SELECTION_INVALID",
};

export const finalizationErrorTranslationByCode: Partial<
  Record<string, TranslationKey>
> = {
  TOURNAMENT_NOT_MUTABLE: "finalization.error.TOURNAMENT_NOT_MUTABLE",
  TOURNAMENT_FINALIZATION_NOT_READY:
    "finalization.error.TOURNAMENT_FINALIZATION_NOT_READY",
  TOURNAMENT_FINALIZATION_UNSUPPORTED_FORMAT:
    "finalization.error.TOURNAMENT_FINALIZATION_UNSUPPORTED_FORMAT",
  TOURNAMENT_FINALIZATION_STANDINGS_INVALID:
    "finalization.error.TOURNAMENT_FINALIZATION_STANDINGS_INVALID",
  TOURNAMENT_CHAMPION_SELECTION_INVALID:
    "finalization.error.TOURNAMENT_CHAMPION_SELECTION_INVALID",
};

export const downstreamResetErrorTranslationByCode: Partial<
  Record<string, TranslationKey>
> = {
  DOWNSTREAM_RESET_NOT_AVAILABLE:
    "competition.reset.error.DOWNSTREAM_RESET_NOT_AVAILABLE",
  DOWNSTREAM_RESET_TOURNAMENT_LOCKED:
    "competition.reset.error.DOWNSTREAM_RESET_TOURNAMENT_LOCKED",
  DOWNSTREAM_RESET_PREVIEW_STALE:
    "competition.reset.error.DOWNSTREAM_RESET_PREVIEW_STALE",
};

export function parseQualificationTieBreakDetails(
  value: Record<string, unknown> | undefined,
): QualificationTieBreakDetails | null {
  if (!value || !Number.isInteger(value.advanceCount)) return null;
  if (
    !Array.isArray(value.fixedQualifiedTeams) ||
    !Array.isArray(value.tieBreaks)
  ) {
    return null;
  }
  const teams = value.fixedQualifiedTeams.filter(isQualificationDecisionTeam);
  const tieBreaks = value.tieBreaks.filter(
    (item): item is QualificationTieBreakDetails["tieBreaks"][number] => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Record<string, unknown>;
      return (
        (candidate.scope === "ROUND" || candidate.scope === "GROUP") &&
        (typeof candidate.groupId === "string" || candidate.groupId === null) &&
        (typeof candidate.groupName === "string" ||
          candidate.groupName === null) &&
        Number.isInteger(candidate.requiredSelections) &&
        Number(candidate.requiredSelections) > 0 &&
        Array.isArray(candidate.candidates) &&
        candidate.candidates.every(isQualificationDecisionTeam)
      );
    },
  );
  if (
    teams.length !== value.fixedQualifiedTeams.length ||
    tieBreaks.length !== value.tieBreaks.length ||
    tieBreaks.length === 0
  ) {
    return null;
  }
  return {
    advanceCount: Number(value.advanceCount),
    fixedQualifiedTeams: teams,
    tieBreaks,
  };
}

function isQualificationDecisionTeam(value: unknown): value is {
  teamId: string;
  name: string;
  seed: number | null;
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.teamId === "string" &&
    typeof candidate.name === "string" &&
    (typeof candidate.seed === "number" || candidate.seed === null)
  );
}

export function parseChampionshipTieBreakDetails(
  value: Record<string, unknown> | undefined,
): ChampionshipTieBreakDetails | null {
  if (!value || !Array.isArray(value.candidates)) return null;
  const candidates = value.candidates.filter(isQualificationDecisionTeam);
  return candidates.length === value.candidates.length && candidates.length > 1
    ? { candidates }
    : null;
}


