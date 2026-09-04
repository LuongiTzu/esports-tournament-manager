import { MatchStatus, RoundStatus } from '@prisma/client';
import type { RoundCompletionResult } from './round-completion';
import { deriveRoundStatus, RoundLifecycleMatch } from './round-lifecycle';

const incomplete: RoundCompletionResult = {
  completed: false,
  code: 'MATCHES_PENDING',
  expectedMatchCount: 1,
  actualMatchCount: 1,
  requiredMatchCount: 1,
  completedRequiredMatchCount: 0,
  currentSwissIteration: null,
  resolvedSwissIterations: null,
};

const pendingMatch: RoundLifecycleMatch = {
  status: MatchStatus.PENDING,
  isActive: true,
  isBye: false,
  scoreA: 0,
  scoreB: 0,
  winnerTeamId: null,
  playedAt: null,
  scoreCount: 0,
};

describe('deriveRoundStatus', () => {
  it('keeps a generated Round upcoming before real match progress', () => {
    expect(deriveRoundStatus(incomplete, [pendingMatch])).toBe(
      RoundStatus.UPCOMING,
    );
  });

  it('does not start a Round from an automatically completed bye', () => {
    expect(
      deriveRoundStatus(incomplete, [
        {
          ...pendingMatch,
          status: MatchStatus.COMPLETED,
          isBye: true,
          winnerTeamId: 'team-a',
        },
      ]),
    ).toBe(RoundStatus.UPCOMING);
  });

  it.each([
    { status: MatchStatus.ONGOING },
    { status: MatchStatus.COMPLETED, winnerTeamId: 'team-a' },
    { scoreA: 1 },
    { scoreCount: 1 },
  ])('marks a Round ongoing from real progress %#', (progress) => {
    expect(
      deriveRoundStatus(incomplete, [{ ...pendingMatch, ...progress }]),
    ).toBe(RoundStatus.ONGOING);
  });

  it('marks a structurally completed Round completed', () => {
    expect(
      deriveRoundStatus({ ...incomplete, completed: true, code: 'COMPLETED' }, [
        { ...pendingMatch, status: MatchStatus.COMPLETED },
      ]),
    ).toBe(RoundStatus.COMPLETED);
  });
});
