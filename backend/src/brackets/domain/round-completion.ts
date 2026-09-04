import { BracketType, MatchStatus, RoundFormat } from '@prisma/client';
import { RoundSettingsFor } from '../types/round-settings';

export interface RoundCompletionMatch {
  status: MatchStatus;
  isActive: boolean;
  isBye: boolean;
  bracketRound: number | null;
  bracketType: BracketType | null;
  matchNumber: number | null;
  groupId: string | null;
  winnerTeamId: string | null;
}

export interface RoundCompletionGroup {
  id: string;
  teamCount: number;
}

type RoundCompletionInputFor<F extends RoundFormat> = {
  format: F;
  settings: RoundSettingsFor<F>;
  participantCount: number;
  matches: readonly RoundCompletionMatch[];
  groups?: readonly RoundCompletionGroup[];
};

export type RoundCompletionInput = {
  [F in RoundFormat]: RoundCompletionInputFor<F>;
}[RoundFormat];

export type RoundCompletionCode =
  | 'NO_STRUCTURE'
  | 'INVALID_PARTICIPANT_COUNT'
  | 'INVALID_STRUCTURE'
  | 'MATCHES_PENDING'
  | 'SWISS_ITERATIONS_PENDING'
  | 'COMPLETED';

export interface RoundCompletionResult {
  completed: boolean;
  code: RoundCompletionCode;
  expectedMatchCount: number | null;
  actualMatchCount: number;
  requiredMatchCount: number;
  completedRequiredMatchCount: number;
  currentSwissIteration: number | null;
  resolvedSwissIterations: number | null;
}

/**
 * Evaluates stage completion from a persisted structure snapshot.
 *
 * This policy is deliberately persistence-neutral. Callers must load the
 * participant snapshot, groups and matches in the same transaction when the
 * result protects a write such as advancement or downstream generation.
 */
export function evaluateRoundCompletion(
  input: RoundCompletionInput,
): RoundCompletionResult {
  const progress = progressOf(input.matches);
  if (input.matches.length === 0) {
    return result(progress, 'NO_STRUCTURE', false, null);
  }

  const minimumTeams = input.format === RoundFormat.DOUBLE_ELIM ? 4 : 2;
  if (
    !Number.isInteger(input.participantCount) ||
    input.participantCount < minimumTeams ||
    input.participantCount > 256
  ) {
    return result(progress, 'INVALID_PARTICIPANT_COUNT', false, null);
  }

  switch (input.format) {
    case RoundFormat.ROUND_ROBIN:
      return evaluateRoundRobin(input, progress);
    case RoundFormat.GROUP_STAGE:
      return evaluateGroupStage(input, progress);
    case RoundFormat.SWISS:
      return evaluateSwiss(input, progress);
    case RoundFormat.PLAYOFF:
      return evaluatePlayoff(input, progress);
    case RoundFormat.DOUBLE_ELIM:
      return evaluateDoubleElimination(input, progress);
  }
}

function evaluateRoundRobin(
  input: RoundCompletionInputFor<typeof RoundFormat.ROUND_ROBIN>,
  progress: MatchProgress,
): RoundCompletionResult {
  const expected =
    pairCount(input.participantCount) * input.settings.meetingsPerPair;
  if (
    input.matches.length !== expected ||
    input.matches.some((match) => !match.isActive) ||
    input.matches.some((match) => match.groupId !== null)
  ) {
    return result(progress, 'INVALID_STRUCTURE', false, expected);
  }
  return completedWhenRequiredMatchesFinish(progress, expected);
}

function evaluateGroupStage(
  input: RoundCompletionInputFor<typeof RoundFormat.GROUP_STAGE>,
  progress: MatchProgress,
): RoundCompletionResult {
  const { numberOfGroups, meetingsPerPair } = input.settings;
  const groups = input.groups ?? [];
  if (
    input.participantCount % numberOfGroups !== 0 ||
    groups.length !== numberOfGroups ||
    new Set(groups.map((group) => group.id)).size !== groups.length
  ) {
    return result(progress, 'INVALID_STRUCTURE', false, null);
  }

  const teamsPerGroup = input.participantCount / numberOfGroups;
  const matchesPerGroup = pairCount(teamsPerGroup) * meetingsPerPair;
  const expected = matchesPerGroup * numberOfGroups;
  const groupIds = new Set(groups.map((group) => group.id));
  const validGroupSizes = groups.every(
    (group) => group.teamCount === teamsPerGroup,
  );
  const validMatchGroups = input.matches.every(
    (match) =>
      match.isActive && match.groupId !== null && groupIds.has(match.groupId),
  );
  const validMatchCounts = groups.every(
    (group) =>
      input.matches.filter((match) => match.groupId === group.id).length ===
      matchesPerGroup,
  );

  if (
    !validGroupSizes ||
    !validMatchGroups ||
    !validMatchCounts ||
    input.matches.length !== expected
  ) {
    return result(progress, 'INVALID_STRUCTURE', false, expected);
  }
  return completedWhenRequiredMatchesFinish(progress, expected);
}

function evaluateSwiss(
  input: RoundCompletionInputFor<typeof RoundFormat.SWISS>,
  progress: MatchProgress,
): RoundCompletionResult {
  const resolvedIterations =
    input.settings.numberOfRounds ??
    Math.ceil(Math.log2(input.participantCount));
  const matchesPerIteration = Math.ceil(input.participantCount / 2);
  const expected = resolvedIterations * matchesPerIteration;
  const rounds = input.matches.map((match) => match.bracketRound);

  if (
    rounds.some(
      (round): boolean =>
        round === null || !Number.isInteger(round) || round < 1,
    ) ||
    input.matches.some((match) => !match.isActive)
  ) {
    return swissResult(
      progress,
      'INVALID_STRUCTURE',
      false,
      expected,
      0,
      resolvedIterations,
    );
  }

  const currentIteration = Math.max(...(rounds as number[]));
  const generatedIterations = new Set(rounds as number[]);
  const iterationsAreConsecutive = Array.from(
    { length: currentIteration },
    (_, index) => index + 1,
  ).every((iteration) => generatedIterations.has(iteration));
  const everyIterationHasExpectedMatches = [...generatedIterations].every(
    (iteration) =>
      input.matches.filter((match) => match.bracketRound === iteration)
        .length === matchesPerIteration,
  );

  if (
    !iterationsAreConsecutive ||
    !everyIterationHasExpectedMatches ||
    currentIteration > resolvedIterations
  ) {
    return swissResult(
      progress,
      'INVALID_STRUCTURE',
      false,
      expected,
      currentIteration,
      resolvedIterations,
    );
  }

  if (progress.completedRequiredMatchCount < progress.requiredMatchCount) {
    return swissResult(
      progress,
      'MATCHES_PENDING',
      false,
      expected,
      currentIteration,
      resolvedIterations,
    );
  }
  if (currentIteration < resolvedIterations) {
    return swissResult(
      progress,
      'SWISS_ITERATIONS_PENDING',
      false,
      expected,
      currentIteration,
      resolvedIterations,
    );
  }
  return swissResult(
    progress,
    'COMPLETED',
    true,
    expected,
    currentIteration,
    resolvedIterations,
  );
}

function evaluatePlayoff(
  input: RoundCompletionInputFor<typeof RoundFormat.PLAYOFF>,
  progress: MatchProgress,
): RoundCompletionResult {
  const bracketSize = nextPowerOfTwo(input.participantCount);
  const expected =
    bracketSize -
    1 +
    (input.settings.thirdPlaceMatch && bracketSize >= 4 ? 1 : 0);
  if (
    input.matches.length !== expected ||
    input.matches.some((match) => !match.isActive) ||
    input.matches.some((match) => match.bracketType !== null)
  ) {
    return result(progress, 'INVALID_STRUCTURE', false, expected);
  }
  return evaluateEliminationCompletion(input.matches, progress, expected);
}

function evaluateDoubleElimination(
  input: RoundCompletionInputFor<typeof RoundFormat.DOUBLE_ELIM>,
  progress: MatchProgress,
): RoundCompletionResult {
  const bracketSize = nextPowerOfTwo(input.participantCount);
  const expected =
    2 * bracketSize - 2 + (input.settings.grandFinalReset ? 1 : 0);
  const winnerMatchCount = input.matches.filter(
    (match) => match.bracketType === BracketType.WINNER,
  ).length;
  const loserMatchCount = input.matches.filter(
    (match) => match.bracketType === BracketType.LOSER,
  ).length;
  const finalMatches = input.matches.filter(
    (match) => match.bracketType === null,
  );
  const inactiveFinalCount = finalMatches.filter(
    (match) => !match.isActive,
  ).length;
  if (
    input.matches.length !== expected ||
    winnerMatchCount !== bracketSize - 1 ||
    loserMatchCount !== bracketSize - 2 ||
    finalMatches.length !== (input.settings.grandFinalReset ? 2 : 1) ||
    (!input.settings.grandFinalReset && inactiveFinalCount > 0) ||
    inactiveFinalCount > 1
  ) {
    return result(progress, 'INVALID_STRUCTURE', false, expected);
  }
  return evaluateEliminationCompletion(input.matches, progress, expected);
}

function evaluateEliminationCompletion(
  matches: readonly RoundCompletionMatch[],
  progress: MatchProgress,
  expected: number,
): RoundCompletionResult {
  if (progress.completedRequiredMatchCount < progress.requiredMatchCount) {
    return result(progress, 'MATCHES_PENDING', false, expected);
  }
  const finalRound = Math.max(
    ...matches
      .filter((match) => match.isActive && match.bracketType === null)
      .map((match) => match.bracketRound ?? 0),
  );
  const championship = matches.find(
    (match) =>
      match.isActive &&
      match.bracketType === null &&
      match.bracketRound === finalRound &&
      match.matchNumber === 1 &&
      match.status === MatchStatus.COMPLETED &&
      match.winnerTeamId !== null,
  );
  return championship
    ? result(progress, 'COMPLETED', true, expected)
    : result(progress, 'INVALID_STRUCTURE', false, expected);
}

function completedWhenRequiredMatchesFinish(
  progress: MatchProgress,
  expected: number,
): RoundCompletionResult {
  return progress.completedRequiredMatchCount === progress.requiredMatchCount
    ? result(progress, 'COMPLETED', true, expected)
    : result(progress, 'MATCHES_PENDING', false, expected);
}

interface MatchProgress {
  actualMatchCount: number;
  requiredMatchCount: number;
  completedRequiredMatchCount: number;
}

function progressOf(matches: readonly RoundCompletionMatch[]): MatchProgress {
  const required = matches.filter((match) => match.isActive);
  return {
    actualMatchCount: matches.length,
    requiredMatchCount: required.length,
    completedRequiredMatchCount: required.filter(
      (match) => match.status === MatchStatus.COMPLETED,
    ).length,
  };
}

function result(
  progress: MatchProgress,
  code: RoundCompletionCode,
  completed: boolean,
  expectedMatchCount: number | null,
): RoundCompletionResult {
  return {
    completed,
    code,
    expectedMatchCount,
    ...progress,
    currentSwissIteration: null,
    resolvedSwissIterations: null,
  };
}

function swissResult(
  progress: MatchProgress,
  code: RoundCompletionCode,
  completed: boolean,
  expectedMatchCount: number,
  currentSwissIteration: number,
  resolvedSwissIterations: number,
): RoundCompletionResult {
  return {
    completed,
    code,
    expectedMatchCount,
    ...progress,
    currentSwissIteration,
    resolvedSwissIterations,
  };
}

function pairCount(teamCount: number): number {
  return (teamCount * (teamCount - 1)) / 2;
}

function nextPowerOfTwo(value: number): number {
  return 2 ** Math.ceil(Math.log2(value));
}
