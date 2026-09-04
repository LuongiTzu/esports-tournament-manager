import { RoundFormat, RoundStatus, TournamentStatus } from '@prisma/client';
import {
  evaluateRoundCompletion,
  RoundCompletionMatch,
} from './round-completion';
import {
  resolveSwissNumberOfRounds,
  SwissSettings,
} from '../types/round-settings';

export type SwissGenerationBlockedReason =
  | 'NOT_GENERATED'
  | 'TOURNAMENT_NOT_MUTABLE'
  | 'ROUND_NOT_MUTABLE'
  | 'CURRENT_ITERATION_INCOMPLETE'
  | 'ALL_ITERATIONS_COMPLETE'
  | 'STRUCTURE_INVALID';

export interface SwissResolvedProgress {
  resolvedNumberOfRounds: number;
  currentIteration: number;
  currentIterationComplete: boolean;
  allIterationsComplete: boolean;
  canGenerateNext: boolean;
  blockedReason: SwissGenerationBlockedReason | null;
}

export function resolveSwissProgress(input: {
  participantCount: number;
  settings: SwissSettings;
  matches: readonly RoundCompletionMatch[];
  roundStatus: RoundStatus;
  tournamentStatus: TournamentStatus;
}): SwissResolvedProgress {
  const resolvedNumberOfRounds = resolveSwissNumberOfRounds(
    input.participantCount,
    input.settings.numberOfRounds,
  );
  const currentIteration = Math.max(
    0,
    ...input.matches.map((match) => match.bracketRound ?? 0),
  );
  const completion = evaluateRoundCompletion({
    format: RoundFormat.SWISS,
    settings: input.settings,
    participantCount: input.participantCount,
    matches: input.matches,
  });
  const currentIterationComplete =
    currentIteration > 0 &&
    (completion.code === 'SWISS_ITERATIONS_PENDING' ||
      completion.code === 'COMPLETED');
  const allIterationsComplete = completion.code === 'COMPLETED';
  const blockedReason = resolveBlockedReason({
    hasStructure: input.matches.length > 0,
    completionCode: completion.code,
    roundStatus: input.roundStatus,
    tournamentStatus: input.tournamentStatus,
  });

  return {
    resolvedNumberOfRounds,
    currentIteration,
    currentIterationComplete,
    allIterationsComplete,
    canGenerateNext: blockedReason === null,
    blockedReason,
  };
}

function resolveBlockedReason(input: {
  hasStructure: boolean;
  completionCode: ReturnType<typeof evaluateRoundCompletion>['code'];
  roundStatus: RoundStatus;
  tournamentStatus: TournamentStatus;
}): SwissGenerationBlockedReason | null {
  if (!input.hasStructure) return 'NOT_GENERATED';
  if (
    input.tournamentStatus === TournamentStatus.DRAFT ||
    input.tournamentStatus === TournamentStatus.COMPLETED ||
    input.tournamentStatus === TournamentStatus.CANCELLED
  ) {
    return 'TOURNAMENT_NOT_MUTABLE';
  }
  if (input.roundStatus === RoundStatus.COMPLETED) {
    return input.completionCode === 'COMPLETED'
      ? 'ALL_ITERATIONS_COMPLETE'
      : 'ROUND_NOT_MUTABLE';
  }
  switch (input.completionCode) {
    case 'SWISS_ITERATIONS_PENDING':
      return null;
    case 'MATCHES_PENDING':
      return 'CURRENT_ITERATION_INCOMPLETE';
    case 'COMPLETED':
      return 'ALL_ITERATIONS_COMPLETE';
    case 'NO_STRUCTURE':
      return 'NOT_GENERATED';
    case 'INVALID_PARTICIPANT_COUNT':
    case 'INVALID_STRUCTURE':
      return 'STRUCTURE_INVALID';
  }
}
