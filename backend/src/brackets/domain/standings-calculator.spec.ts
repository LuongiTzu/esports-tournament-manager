import { MatchOutcome, RoundFormat } from '@prisma/client';
import {
  calculateStandingsRows,
  resolvePointSettings,
} from './standings-calculator';

describe('standings calculator', () => {
  const teams = [
    { id: 'a', name: 'A', seed: 2 },
    { id: 'b', name: 'B', seed: 1 },
  ];

  it('preserves Round Robin point and score-difference ranking', () => {
    const rows = calculateStandingsRows(
      teams,
      [
        {
          teamAId: 'a',
          teamBId: 'b',
          scoreA: 2,
          scoreB: 1,
          winnerTeamId: 'a',
          outcome: MatchOutcome.TEAM_A,
          isBye: false,
        },
      ],
      resolvePointSettings(RoundFormat.ROUND_ROBIN, {
        winPoints: 3,
        drawPoints: 1,
        lossPoints: 0,
        allowDraws: true,
      }),
    );
    expect(
      rows.map((row) => [row.id, row.points, row.scoreDifference]),
    ).toEqual([
      ['a', 3, 1],
      ['b', 0, -1],
    ]);
  });

  it('preserves draw scoring and deterministic seed fallback', () => {
    const rows = calculateStandingsRows(
      teams,
      [
        {
          teamAId: 'a',
          teamBId: 'b',
          scoreA: 1,
          scoreB: 1,
          winnerTeamId: null,
          outcome: MatchOutcome.DRAW,
          isBye: false,
        },
      ],
      resolvePointSettings(RoundFormat.GROUP_STAGE, {
        winPoints: 3,
        drawPoints: 1,
        lossPoints: 0,
        allowDraws: true,
      }),
    );
    expect(rows.map((row) => row.id)).toEqual(['b', 'a']);
    expect(rows.every((row) => row.points === 1 && row.draws === 1)).toBe(true);
  });
});
