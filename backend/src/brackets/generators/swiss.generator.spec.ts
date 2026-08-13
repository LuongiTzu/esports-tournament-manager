import { BracketTeam } from '../types/bracket-generator';
import { SwissSettings } from '../types/round-settings';
import { SwissMatchSnapshot } from '../types/swiss';
import { SwissGenerator } from './swiss.generator';

const settings: SwissSettings = {
  numRounds: 5,
  pointsWin: 3,
  pointsDraw: 1,
  pointsLoss: 0,
  tiebreakers: ['BUCHHOLZ', 'HEAD_TO_HEAD', 'SCORE_DIFF'],
  advanceCount: 8,
};

function teams(count: number): BracketTeam[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    seed: index + 1,
    registeredAt: new Date(2026, 0, index + 1),
  }));
}

function snapshot(
  a: string,
  b: string | null,
  scoreA: number,
  scoreB: number,
  round = 1,
  completed = true,
): SwissMatchSnapshot {
  return {
    teamAId: a,
    teamBId: b,
    scoreA,
    scoreB,
    bracketRound: round,
    isBye: b === null,
    completed,
  };
}

describe('SwissGenerator', () => {
  const generator = new SwissGenerator();

  it.each([8, 16])(
    'pairs the first half against the second half for %i teams',
    (count) => {
      const result = generator.generateNext({
        teams: teams(count),
        matches: [],
        settings,
        bestOf: 3,
        bracketRound: 1,
      });

      expect(result.matches).toHaveLength(count / 2);
      result.matches.forEach((match, index) => {
        expect(match.teamA.teamId).toBe(`team-${index + 1}`);
        expect(match.teamB.teamId).toBe(`team-${index + 1 + count / 2}`);
      });
    },
  );

  it('generates one explicit bye for 17 teams', () => {
    const result = generator.generateNext({
      teams: teams(17),
      matches: [],
      settings,
      bestOf: 1,
      bracketRound: 1,
    });

    expect(result.matches).toHaveLength(9);
    expect(result.matches.filter((match) => match.isBye)).toHaveLength(1);
    expect(result.matches.find((match) => match.isBye)?.teamA.teamId).toBe(
      'team-17',
    );
  });

  it('avoids repeated pairings when an alternative exists', () => {
    const teamList = teams(8);
    const first = generator.generateNext({
      teams: teamList,
      matches: [],
      settings,
      bestOf: 1,
      bracketRound: 1,
    });
    const history = first.matches.map((match) =>
      snapshot(match.teamA.teamId!, match.teamB.teamId, 1, 0),
    );
    const second = generator.generateNext({
      teams: teamList,
      matches: history,
      settings,
      bestOf: 1,
      bracketRound: 2,
    });
    const oldPairs = new Set(
      history.map((match) => [match.teamAId, match.teamBId].sort().join(':')),
    );

    expect(second.warnings).toEqual([]);
    expect(
      second.matches.every(
        (match) =>
          !oldPairs.has(
            [match.teamA.teamId, match.teamB.teamId].sort().join(':'),
          ),
      ),
    ).toBe(true);
  });

  it('distributes consecutive byes to different eligible teams', () => {
    const teamList = teams(17);
    const first = generator.generateNext({
      teams: teamList,
      matches: [],
      settings,
      bestOf: 1,
      bracketRound: 1,
    });
    const firstBye = first.matches.find((match) => match.isBye)!;
    const history = first.matches.map((match) =>
      snapshot(match.teamA.teamId!, match.teamB.teamId, 1, 0),
    );
    const second = generator.generateNext({
      teams: teamList,
      matches: history,
      settings,
      bestOf: 1,
      bracketRound: 2,
    });

    expect(second.matches.find((match) => match.isBye)?.teamA.teamId).not.toBe(
      firstBye.teamA.teamId,
    );
  });

  it('calculates Buchholz, Buchholz cut-1 and score difference', () => {
    const result = generator.calculateStandings(
      teams(4),
      [
        snapshot('team-1', 'team-2', 2, 0, 1),
        snapshot('team-3', 'team-4', 1, 0, 1),
        snapshot('team-1', 'team-3', 2, 1, 2),
        snapshot('team-2', 'team-4', 2, 0, 2),
      ],
      settings,
    );
    const byId = new Map(result.map((row) => [row.teamId, row]));

    expect(byId.get('team-1')).toMatchObject({
      points: 6,
      buchholz: 6,
      buchholzCut1: 3,
      scoreDifference: 3,
    });
    expect(byId.get('team-4')).toMatchObject({
      points: 0,
      buchholz: 6,
      buchholzCut1: 3,
      scoreDifference: -3,
    });
  });

  it('uses head-to-head after equal points and Buchholz criteria', () => {
    const result = generator.calculateStandings(
      teams(4),
      [
        snapshot('team-2', 'team-1', 1, 0, 1),
        snapshot('team-1', 'team-3', 1, 0, 2),
        snapshot('team-2', 'team-4', 0, 1, 2),
        snapshot('team-3', 'team-4', 1, 0, 1),
      ],
      settings,
    );

    expect(result.findIndex((row) => row.teamId === 'team-2')).toBeLessThan(
      result.findIndex((row) => row.teamId === 'team-1'),
    );
  });

  it('ignores incomplete matches in current standings', () => {
    const result = generator.calculateStandings(
      teams(2),
      [snapshot('team-1', 'team-2', 9, 0, 1, false)],
      settings,
    );

    expect(result.map((row) => row.points)).toEqual([0, 0]);
    expect(result.map((row) => row.scoreDifference)).toEqual([0, 0]);
  });

  it('is deterministic for identical pairing input', () => {
    const input = {
      teams: teams(8),
      matches: [
        snapshot('team-1', 'team-5', 1, 0),
        snapshot('team-2', 'team-6', 1, 0),
        snapshot('team-3', 'team-7', 0, 1),
        snapshot('team-4', 'team-8', 0, 1),
      ],
      settings,
      bestOf: 3,
      bracketRound: 2,
    };

    expect(generator.generateNext(input)).toEqual(
      generator.generateNext(input),
    );
  });

  it('warns when a rematch is mathematically unavoidable', () => {
    const result = generator.generateNext({
      teams: teams(2),
      matches: [snapshot('team-1', 'team-2', 1, 0)],
      settings,
      bestOf: 1,
      bracketRound: 2,
    });

    expect(result.matches).toHaveLength(1);
    expect(result.warnings).toEqual([
      'Swiss round 2: rematch was mathematically unavoidable',
    ]);
  });

  it('uses ceil(log2(n)) unless an override is provided', () => {
    expect(generator.resolveNumRounds(8)).toBe(3);
    expect(generator.resolveNumRounds(16)).toBe(4);
    expect(generator.resolveNumRounds(17)).toBe(5);
    expect(generator.resolveNumRounds(8, 6)).toBe(6);
  });
});
