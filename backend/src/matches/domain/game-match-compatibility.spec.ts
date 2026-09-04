import { MatchOutcome, MatchStatus, RoundFormat } from '@prisma/client';
import { GAME_CATALOG } from '../../games/game-catalog';
import { MatchResultPolicy } from './match-result.policy';

describe('canonical Game Match compatibility', () => {
  const policy = new MatchResultPolicy();

  it.each(GAME_CATALOG)(
    '$code uses the same Team-vs-Team result policy at core size $defaultTeamSize',
    () => {
      expect(
        policy.evaluateAggregate(
          {
            bestOf: 1,
            teamAId: 'team-a',
            teamBId: 'team-b',
            roundFormat: RoundFormat.PLAYOFF,
            roundSettings: null,
          },
          1,
          0,
          MatchStatus.COMPLETED,
        ),
      ).toEqual({
        winnerTeamId: 'team-a',
        outcome: MatchOutcome.TEAM_A,
      });
    },
  );

  it.each([
    ['FC Online individual', 1, 1],
    ['FC Online team', 3, 4],
    ['CrossFire', 5, 6],
    ['MOBA roster', 5, 8],
    ['Custom 5v5', 5, 7],
    ['Custom 20v20', 20, 30],
  ])('keeps %s snapshot %i/%i outside Match result inputs', () => {
    expect(
      policy.evaluateSeries(
        [
          { setNumber: 1, teamAScore: 10, teamBScore: 5 },
          { setNumber: 2, teamAScore: 5, teamBScore: 10 },
          { setNumber: 3, teamAScore: 10, teamBScore: 5 },
        ],
        3,
      ),
    ).toEqual({ scoreA: 2, scoreB: 1, completed: true });
  });

  it('represents an FC Online 2-2 score through POINT_SCORE settings', () => {
    expect(GAME_CATALOG.some((game) => game.code === 'FC_ONLINE')).toBe(true);
    expect(
      policy.evaluateAggregate(
        {
          bestOf: 1,
          teamAId: 'team-a',
          teamBId: 'team-b',
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
});
