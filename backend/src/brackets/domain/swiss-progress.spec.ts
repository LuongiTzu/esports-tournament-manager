import { MatchStatus, RoundStatus, TournamentStatus } from '@prisma/client';
import { RoundCompletionMatch } from './round-completion';
import { resolveSwissProgress } from './swiss-progress';

const match = (
  bracketRound: number,
  status: MatchStatus = MatchStatus.COMPLETED,
): RoundCompletionMatch => ({
  status,
  isActive: true,
  isBye: false,
  bracketRound,
  bracketType: null,
  matchNumber: 1,
  groupId: null,
  winnerTeamId: status === MatchStatus.COMPLETED ? 'team-a' : null,
});

const base = {
  participantCount: 4,
  settings: { numberOfRounds: 2, advancingTeamCount: 2 },
  roundStatus: RoundStatus.ONGOING,
  tournamentStatus: TournamentStatus.ONGOING,
};

describe('resolveSwissProgress', () => {
  it('resolves automatic round count from the participant snapshot', () => {
    expect(
      resolveSwissProgress({
        ...base,
        participantCount: 8,
        settings: { ...base.settings, numberOfRounds: null },
        matches: [],
      }),
    ).toMatchObject({
      resolvedNumberOfRounds: 3,
      currentIteration: 0,
      canGenerateNext: false,
      blockedReason: 'NOT_GENERATED',
    });
  });

  it('allows the next iteration only after the complete current pairing', () => {
    expect(
      resolveSwissProgress({
        ...base,
        matches: [match(1), { ...match(1), matchNumber: 2 }],
      }),
    ).toMatchObject({
      currentIteration: 1,
      currentIterationComplete: true,
      allIterationsComplete: false,
      canGenerateNext: true,
      blockedReason: null,
    });
  });

  it('blocks while a current-iteration match is pending', () => {
    expect(
      resolveSwissProgress({
        ...base,
        matches: [
          match(1),
          { ...match(1, MatchStatus.PENDING), matchNumber: 2 },
        ],
      }),
    ).toMatchObject({
      currentIterationComplete: false,
      canGenerateNext: false,
      blockedReason: 'CURRENT_ITERATION_INCOMPLETE',
    });
  });

  it('reports completion after the resolved final iteration', () => {
    expect(
      resolveSwissProgress({
        ...base,
        roundStatus: RoundStatus.COMPLETED,
        matches: [
          match(1),
          { ...match(1), matchNumber: 2 },
          match(2),
          { ...match(2), matchNumber: 2 },
        ],
      }),
    ).toMatchObject({
      currentIteration: 2,
      allIterationsComplete: true,
      canGenerateNext: false,
      blockedReason: 'ALL_ITERATIONS_COMPLETE',
    });
  });

  it('reports an invalid persisted pairing structure', () => {
    expect(
      resolveSwissProgress({ ...base, matches: [match(1)] }),
    ).toMatchObject({
      canGenerateNext: false,
      blockedReason: 'STRUCTURE_INVALID',
    });
  });
});
