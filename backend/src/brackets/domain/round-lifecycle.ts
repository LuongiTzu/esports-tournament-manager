import { MatchStatus, RoundStatus } from '@prisma/client';
import type { RoundCompletionResult } from './round-completion';

export interface RoundLifecycleMatch {
  status: MatchStatus;
  isActive: boolean;
  isBye: boolean;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
  playedAt: Date | null;
  scoreCount: number;
}

/** Derives persisted Round status from competition facts, never from UI intent. */
export function deriveRoundStatus(
  completion: RoundCompletionResult,
  matches: readonly RoundLifecycleMatch[],
): RoundStatus {
  if (completion.completed) return RoundStatus.COMPLETED;

  const hasRealMatchProgress = matches.some(
    (match) =>
      match.isActive &&
      !match.isBye &&
      (match.status !== MatchStatus.PENDING ||
        match.scoreA !== 0 ||
        match.scoreB !== 0 ||
        match.winnerTeamId !== null ||
        match.playedAt !== null ||
        match.scoreCount > 0),
  );
  return hasRealMatchProgress ? RoundStatus.ONGOING : RoundStatus.UPCOMING;
}
