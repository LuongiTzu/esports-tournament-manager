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

  it.each([1, 3, 5, 7])('accepts generic BO%i', (bestOf) => {
    expect(() => policy.assertBestOf(bestOf)).not.toThrow();
  });

  it('determines TEAM_A and TEAM_B winners at the series threshold', () => {
    expect(
      policy.evaluateAggregate(context, 2, 1, MatchStatus.COMPLETED),
    ).toEqual({ winnerTeamId: 'team-a', outcome: MatchOutcome.TEAM_A });
    expect(
      policy.evaluateAggregate(context, 0, 2, MatchStatus.COMPLETED),
    ).toEqual({ winnerTeamId: 'team-b', outcome: MatchOutcome.TEAM_B });
  });

  it('treats POINT_SCORE as raw goals or points without a BO win cap', () => {
    const pointContext = {
      ...context,
      bestOf: 1,
      roundSettings: { scoringMode: 'POINT_SCORE' },
    };

    expect(
      policy.evaluateAggregate(pointContext, 7, 5, MatchStatus.COMPLETED),
    ).toEqual({ winnerTeamId: 'team-a', outcome: MatchOutcome.TEAM_A });
    expect(
      policy.evaluateAggregate(pointContext, 2, 4, MatchStatus.COMPLETED),
    ).toEqual({ winnerTeamId: 'team-b', outcome: MatchOutcome.TEAM_B });
  });

  it('supports a POINT_SCORE draw only when the scoring format allows it', () => {
    expect(
      policy.evaluateAggregate(
        {
          ...context,
          bestOf: 1,
          roundFormat: RoundFormat.GROUP_STAGE,
          roundSettings: {
            scoringMode: 'POINT_SCORE',
            allowDraws: true,
          },
        },
        2,
        2,
        MatchStatus.COMPLETED,
      ),
    ).toEqual({ winnerTeamId: null, outcome: MatchOutcome.DRAW });
  });

  it('rejects POINT_SCORE with BO3 or greater', () => {
    expect(() =>
      policy.evaluateAggregate(
        {
          ...context,
          roundSettings: { scoringMode: 'POINT_SCORE' },
        },
        2,
        1,
        MatchStatus.COMPLETED,
      ),
    ).toThrow('POINT_SCORE requires bestOf = 1');
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

  it('copies the single detailed POINT_SCORE record into the aggregate', () => {
    expect(
      policy.evaluateDetailedScores(
        [{ setNumber: 1, teamAScore: 3, teamBScore: 3 }],
        {
          ...context,
          bestOf: 1,
          roundFormat: RoundFormat.ROUND_ROBIN,
          roundSettings: {
            scoringMode: 'POINT_SCORE',
            allowDraws: true,
          },
        },
      ),
    ).toEqual({ scoreA: 3, scoreB: 3, completed: true });
  });

  it('completes BO7 at four wins and rejects a game after the clinch', () => {
    const clinched = [
      { setNumber: 1, teamAScore: 1, teamBScore: 0 },
      { setNumber: 2, teamAScore: 0, teamBScore: 1 },
      { setNumber: 3, teamAScore: 1, teamBScore: 0 },
      { setNumber: 4, teamAScore: 1, teamBScore: 0 },
      { setNumber: 5, teamAScore: 1, teamBScore: 0 },
    ];
    expect(policy.evaluateSeries(clinched, 7)).toEqual({
      scoreA: 4,
      scoreB: 1,
      completed: true,
    });
    expect(() =>
      policy.evaluateSeries(
        [...clinched, { setNumber: 6, teamAScore: 0, teamBScore: 1 }],
        7,
      ),
    ).toThrow('after the series was already won');
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
