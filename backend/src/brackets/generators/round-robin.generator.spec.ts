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

function generate(count: number, doubleRound = false): MatchDraft[] {
  return new RoundRobinGenerator().generate({
    format: RoundFormat.ROUND_ROBIN,
    teams: teams(count),
    settings: {
      ...DEFAULT_ROUND_SETTINGS[RoundFormat.ROUND_ROBIN],
      doubleRound,
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
    [5, 5, 15],
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

  it('gives each of 5 teams exactly one bye', () => {
    const byes = generate(5).filter((match) => match.isBye);

    expect(byes).toHaveLength(5);
    expect(new Set(byes.map((match) => match.teamA.teamId))).toEqual(
      new Set(teams(5).map((team) => team.id)),
    );
    expect(byes.every((match) => match.teamB.teamId === null)).toBe(true);
  });

  it('generates a reversed second half when doubleRound is enabled', () => {
    const result = generate(4, true);
    const firstHalf = result.filter((match) => match.bracketRound <= 3);
    const secondHalf = result.filter((match) => match.bracketRound > 3);

    expect(rounds(result).size).toBe(6);
    expect(result).toHaveLength(12);
    firstHalf.forEach((match, index) => {
      expect(secondHalf[index].teamA.teamId).toBe(match.teamB.teamId);
      expect(secondHalf[index].teamB.teamId).toBe(match.teamA.teamId);
    });
  });

  it.each([4, 5, 6, 8])(
    'contains every matchup exactly once for %i teams',
    (count) => {
      const keys = generate(count)
        .map(pairKey)
        .filter((key) => key !== null);

      expect(keys).toHaveLength((count * (count - 1)) / 2);
      expect(new Set(keys).size).toBe(keys.length);
    },
  );

  it.each([4, 5, 6, 8])(
    'schedules every team exactly once per round for %i teams',
    (count) => {
      for (const matches of rounds(generate(count)).values()) {
        const appearances = matches.flatMap((match) =>
          [match.teamA.teamId, match.teamB.teamId].filter(
            (id): id is string => id !== null,
          ),
        );
        expect(appearances).toHaveLength(count);
        expect(new Set(appearances).size).toBe(count);
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
      expect(matches.map((match) => match.matchNumber)).toEqual([1, 2, 3]);
      expect(matches.map((match) => match.key)).toEqual([
        `round-robin-${roundNumber}-1`,
        `round-robin-${roundNumber}-2`,
        `round-robin-${roundNumber}-3`,
      ]);
    }
  });
});
