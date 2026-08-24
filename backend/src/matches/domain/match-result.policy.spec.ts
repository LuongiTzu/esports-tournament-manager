import { MatchOutcome, MatchStatus, RoundFormat } from '@prisma/client';
import { MatchResultPolicy } from './match-result.policy';

describe('MatchResultPolicy', () => {
  const policy = new MatchResultPolicy();
  const context = {
    bestOf: 3,
    teamAId: 'team-a',
    teamBId: 'team-b',
    roundFormat: RoundFormat.PLAYOFF,
    roundSettings: null,
  };

  it.each([0, 2, -1])('rejects invalid bestOf %s', (bestOf) => {
    expect(() => policy.assertBestOf(bestOf)).toThrow(
      'bestOf must be a positive odd number',
    );
  });

  it('determines TEAM_A and TEAM_B winners at the series threshold', () => {
    expect(
      policy.evaluateAggregate(context, 2, 1, MatchStatus.COMPLETED),
    ).toEqual({ winnerTeamId: 'team-a', outcome: MatchOutcome.TEAM_A });
    expect(
      policy.evaluateAggregate(context, 0, 2, MatchStatus.COMPLETED),
    ).toEqual({ winnerTeamId: 'team-b', outcome: MatchOutcome.TEAM_B });
  });

  it('allows draws only for configured Round Robin or Group Stage rounds', () => {
    expect(
      policy.evaluateAggregate(
        {
          ...context,
          roundFormat: RoundFormat.GROUP_STAGE,
          roundSettings: { allowDraws: true },
        },
        1,
        1,
        MatchStatus.COMPLETED,
      ),
    ).toEqual({ winnerTeamId: null, outcome: MatchOutcome.DRAW });
    expect(() =>
      policy.evaluateAggregate(context, 1, 1, MatchStatus.COMPLETED),
    ).toThrow('Completed match must have one valid winner');
  });

  it('rejects invalid aggregate completion and clinched ongoing results', () => {
    expect(() =>
      policy.evaluateAggregate(context, 1, 0, MatchStatus.COMPLETED),
    ).toThrow('Completed match must have one valid winner');
    expect(() =>
      policy.evaluateAggregate(context, 2, 0, MatchStatus.ONGOING),
    ).toThrow('A clinched series must be COMPLETED');
  });

  it('evaluates canonical per-game series scores', () => {
    expect(
      policy.evaluateSeries(
        [
          { setNumber: 1, teamAScore: 10, teamBScore: 5 },
          { setNumber: 2, teamAScore: 4, teamBScore: 8 },
          { setNumber: 3, teamAScore: 7, teamBScore: 3 },
        ],
        3,
      ),
    ).toEqual({ scoreA: 2, scoreB: 1, completed: true });
  });

  it.each([
    [[{ setNumber: 1, teamAScore: 5, teamBScore: 5 }], 'draw'],
    [
      [
        { setNumber: 1, teamAScore: 5, teamBScore: 1 },
        { setNumber: 1, teamAScore: 5, teamBScore: 1 },
      ],
      'unique',
    ],
    [[{ setNumber: 2, teamAScore: 5, teamBScore: 1 }], 'consecutive'],
  ])('rejects invalid per-game scores (%s)', (scores, message) => {
    expect(() => policy.evaluateSeries(scores, 3)).toThrow(message);
  });
});
