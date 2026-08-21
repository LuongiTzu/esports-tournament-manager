import { RoundFormat } from '@prisma/client';
import { BracketTeam, MatchDraft } from '../types/bracket-generator';
import { DEFAULT_ROUND_SETTINGS } from '../types/round-settings';
import { RoundRobinGenerator } from './round-robin.generator';

function teams(count: number): BracketTeam[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    seed: index + 1,
    registeredAt: new Date(2026, 0, index + 1),
  }));
}

function generate(count: number, meetingsPerPair = 1): MatchDraft[] {
  return new RoundRobinGenerator().generate({
    format: RoundFormat.ROUND_ROBIN,
    teams: teams(count),
    settings: {
      ...DEFAULT_ROUND_SETTINGS[RoundFormat.ROUND_ROBIN],
      meetingsPerPair,
    },
    bestOf: 3,
  });
}

function rounds(matches: MatchDraft[]): Map<number, MatchDraft[]> {
  const result = new Map<number, MatchDraft[]>();
  for (const match of matches) {
    const round = result.get(match.bracketRound) ?? [];
    round.push(match);
    result.set(match.bracketRound, round);
  }
  return result;
}

function pairKey(match: MatchDraft): string | null {
  if (match.isBye) return null;
  return [match.teamA.teamId, match.teamB.teamId].sort().join(':');
}

describe('RoundRobinGenerator', () => {
  it.each([
    [4, 3, 6],
    [5, 5, 10],
    [6, 5, 15],
    [8, 7, 28],
  ])(
    'generates Circle Method fixtures for %i teams',
    (count, roundCount, matchCount) => {
      const result = generate(count);

      expect(rounds(result).size).toBe(roundCount);
      expect(result).toHaveLength(matchCount);
      expect(result.every((match) => match.bestOf === 3)).toBe(true);
    },
  );

  it('does not persist fake bye matches for odd team counts', () => {
    const result = generate(5);

    expect(result).toHaveLength(10);
    expect(result.every((match) => !match.isBye)).toBe(true);
    expect(result.every((match) => match.teamB.teamId !== null)).toBe(true);
  });

  it('reverses sides on the second meeting cycle', () => {
    const result = generate(4, 2);
    const firstHalf = result.filter((match) => match.bracketRound <= 3);
    const secondHalf = result.filter((match) => match.bracketRound > 3);

    expect(rounds(result).size).toBe(6);
    expect(result).toHaveLength(12);
    firstHalf.forEach((match, index) => {
      expect(secondHalf[index].teamA.teamId).toBe(match.teamB.teamId);
      expect(secondHalf[index].teamB.teamId).toBe(match.teamA.teamId);
    });
  });

  it.each([
    [4, 1, 6],
    [4, 2, 12],
    [5, 1, 10],
    [5, 2, 20],
    [6, 1, 15],
  ])(
    'generates %i teams x %i meetings as %i real matches',
    (count, meetings, expected) => {
      expect(generate(count, meetings)).toHaveLength(expected);
    },
  );

  it.each([4, 5, 6, 8])(
    'contains every matchup exactly K times for %i teams',
    (count) => {
      const meetings = 3;
      const keys = generate(count, meetings)
        .map(pairKey)
        .filter((key) => key !== null);

      expect(keys).toHaveLength(((count * (count - 1)) / 2) * meetings);
      const counts = new Map<string, number>();
      keys.forEach((key) => counts.set(key, (counts.get(key) ?? 0) + 1));
      expect([...counts.values()].every((value) => value === meetings)).toBe(
        true,
      );
    },
  );

  it('never schedules a team against itself', () => {
    expect(
      generate(5, 4).every(
        (match) => match.teamA.teamId !== match.teamB.teamId,
      ),
    ).toBe(true);
  });

  it.each([4, 5, 6, 8])(
    'schedules every team exactly once per round for %i teams',
    (count) => {
      for (const matches of rounds(generate(count)).values()) {
        const appearances = matches.flatMap((match) =>
          [match.teamA.teamId, match.teamB.teamId].filter(
            (id): id is string => id !== null,
          ),
        );
        expect(appearances).toHaveLength(count - (count % 2));
        expect(new Set(appearances).size).toBe(count - (count % 2));
      }
    },
  );

  it('preserves input order in the initial Berger pairing', () => {
    const result = generate(4);

    expect(result[0].teamA.teamId).toBe('team-1');
    expect(result[0].teamB.teamId).toBe('team-4');
    expect(result[1].teamA.teamId).toBe('team-2');
    expect(result[1].teamB.teamId).toBe('team-3');
  });

  it('supports the minimum valid team count', () => {
    const result = generate(2);

    expect(rounds(result).size).toBe(1);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      bracketRound: 1,
      matchNumber: 1,
      isBye: false,
    });
  });

  it('rejects one team', () => {
    expect(() => generate(1)).toThrow('at least 2 teams');
  });

  it('rejects duplicated team IDs', () => {
    const duplicated = teams(4);
    duplicated[3].id = duplicated[0].id;

    expect(() =>
      new RoundRobinGenerator().generate({
        format: RoundFormat.ROUND_ROBIN,
        teams: duplicated,
        settings: DEFAULT_ROUND_SETTINGS[RoundFormat.ROUND_ROBIN],
        bestOf: 1,
      }),
    ).toThrow('team IDs must be unique');
  });

  it('assigns deterministic match numbers and keys within every round', () => {
    for (const [roundNumber, matches] of rounds(generate(5))) {
      expect(matches.map((match) => match.matchNumber)).toEqual([1, 2]);
      expect(matches.map((match) => match.key)).toEqual([
        `round-robin-${roundNumber}-1`,
        `round-robin-${roundNumber}-2`,
      ]);
    }
  });
});
