import { RoundFormat } from '@prisma/client';
import { BracketTeam, MatchDraft } from '../types/bracket-generator';
import { PlayoffGenerator } from './playoff.generator';

function teams(count: number): BracketTeam[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    seed: index + 1,
    registeredAt: new Date(2026, 0, index + 1),
  }));
}

function generate(count: number, thirdPlaceMatch = false): MatchDraft[] {
  return new PlayoffGenerator().generate({
    format: RoundFormat.PLAYOFF,
    teams: teams(count),
    settings: { thirdPlaceMatch },
    bestOf: 3,
  });
}

function standard(matches: MatchDraft[]): MatchDraft[] {
  return matches.filter((match) => match.matchKind === 'STANDARD');
}

describe('PlayoffGenerator', () => {
  it.each([
    [2, 2, 1, 1],
    [4, 4, 2, 3],
    [8, 8, 3, 7],
    [16, 16, 4, 15],
    [6, 8, 3, 7],
    [10, 16, 4, 15],
  ])(
    'generates a complete %i-team playoff using bracket size %i',
    (teamCount, _bracketSize, roundCount, matchCount) => {
      const result = standard(generate(teamCount));

      expect(result).toHaveLength(matchCount);
      expect(new Set(result.map((match) => match.bracketRound)).size).toBe(
        roundCount,
      );
      expect(result.every((match) => match.bestOf === 3)).toBe(true);
    },
  );

  it('uses the required standard 16-seed first-round ordering', () => {
    const firstRound = generate(16).filter((match) => match.bracketRound === 1);

    expect(
      firstRound.map((match) => [match.teamA.teamId, match.teamB.teamId]),
    ).toEqual([
      ['team-1', 'team-16'],
      ['team-8', 'team-9'],
      ['team-5', 'team-12'],
      ['team-4', 'team-13'],
      ['team-6', 'team-11'],
      ['team-3', 'team-14'],
      ['team-7', 'team-10'],
      ['team-2', 'team-15'],
    ]);
  });

  it.each([
    [6, 2],
    [10, 6],
  ])('places %i-team field into seeded bye slots', (count, byeCount) => {
    const firstRound = generate(count).filter(
      (match) => match.bracketRound === 1,
    );
    const byes = firstRound.filter((match) => match.isBye);

    expect(byes).toHaveLength(byeCount);
    expect(
      byes.every((match) => match.teamA.teamId && !match.teamB.teamId),
    ).toBe(true);
    expect(
      byes.map((match) => Number(match.teamA.teamId!.replace('team-', ''))),
    ).toEqual(
      expect.arrayContaining(Array.from({ length: byeCount }, (_, i) => i + 1)),
    );
  });

  it.each([3, 5, 6, 7, 8])(
    'includes every one of %i teams exactly once in the opening round',
    (count) => {
      const openingTeams = generate(count)
        .filter((match) => match.bracketRound === 1)
        .flatMap((match) => [match.teamA.teamId, match.teamB.teamId])
        .filter((teamId): teamId is string => teamId !== null);

      expect(openingTeams).toHaveLength(count);
      expect(new Set(openingTeams).size).toBe(count);
      expect(
        standard(generate(count)).filter((match) => !match.isBye),
      ).toHaveLength(count - 1);
    },
  );

  it('links every non-final match to the correct next match and slot', () => {
    const result = standard(generate(8));
    const roundOne = result.filter((match) => match.bracketRound === 1);

    expect(
      roundOne.map((match) => [match.nextMatchKey, match.nextMatchSlot]),
    ).toEqual([
      ['playoff-2-1', 'A'],
      ['playoff-2-1', 'B'],
      ['playoff-2-2', 'A'],
      ['playoff-2-2', 'B'],
    ]);
    expect(result.find((match) => match.key === 'playoff-3-1')).toMatchObject({
      roundName: 'Chung kết',
      nextMatchKey: null,
      nextMatchSlot: null,
    });
  });

  it('uses unresolved winner sources after the first round', () => {
    const semifinal = generate(8).find((match) => match.key === 'playoff-2-1')!;

    expect(semifinal.teamA).toEqual({
      teamId: null,
      sourceMatchKey: 'playoff-1-1',
      sourceResult: 'WINNER',
    });
    expect(semifinal.teamB).toEqual({
      teamId: null,
      sourceMatchKey: 'playoff-1-2',
      sourceResult: 'WINNER',
    });
  });

  it('assigns localized round names', () => {
    const result = generate(16);

    expect([
      ...new Map(
        result.map((match) => [match.bracketRound, match.roundName]),
      ).values(),
    ]).toEqual(['Vòng loại (Round of 16)', 'Tứ kết', 'Bán kết', 'Chung kết']);
  });

  it('omits the third-place match when disabled', () => {
    expect(generate(8).some((match) => match.matchKind === 'THIRD_PLACE')).toBe(
      false,
    );
  });

  it('creates a third-place match sourced from semifinal losers', () => {
    const result = generate(8, true);
    const bronze = result.find((match) => match.matchKind === 'THIRD_PLACE')!;

    expect(result).toHaveLength(8);
    expect(bronze).toMatchObject({
      key: 'playoff-third-place',
      roundName: 'Tranh hạng ba',
      teamA: {
        teamId: null,
        sourceMatchKey: 'playoff-2-1',
        sourceResult: 'LOSER',
      },
      teamB: {
        teamId: null,
        sourceMatchKey: 'playoff-2-2',
        sourceResult: 'LOSER',
      },
    });
    expect(result.find((match) => match.key === 'playoff-2-1')).toMatchObject({
      loserNextMatchKey: 'playoff-third-place',
      loserNextMatchSlot: 'A',
    });
    expect(result.find((match) => match.key === 'playoff-2-2')).toMatchObject({
      loserNextMatchKey: 'playoff-third-place',
      loserNextMatchSlot: 'B',
    });
  });

  it('is deterministic and does not mutate input order', () => {
    const inputTeams = teams(10).reverse();
    const generator = new PlayoffGenerator();
    const input = {
      format: RoundFormat.PLAYOFF,
      teams: inputTeams,
      settings: { thirdPlaceMatch: false },
      bestOf: 1,
    };

    expect(generator.generate(input)).toEqual(generator.generate(input));
    expect(inputTeams.map((team) => team.id)).toEqual(
      teams(10)
        .reverse()
        .map((team) => team.id),
    );
  });
});
