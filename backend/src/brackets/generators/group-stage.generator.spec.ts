import { RoundFormat } from '@prisma/client';
import { BracketTeam } from '../types/bracket-generator';
import { GroupStageSettings } from '../types/round-settings';
import { GroupStageGenerator } from './group-stage.generator';
import { RoundRobinGenerator } from './round-robin.generator';

function teams(count: number): BracketTeam[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    seed: index + 1,
    registeredAt: new Date(2026, 0, index + 1),
  }));
}

function input(teamList: BracketTeam[], settings: GroupStageSettings) {
  return {
    format: RoundFormat.GROUP_STAGE,
    teams: teamList,
    settings,
    bestOf: 3,
  } as const;
}

function settings(
  overrides: Partial<GroupStageSettings> = {},
): GroupStageSettings {
  return {
    numberOfGroups: 2,
    advancingTeamsPerGroup: 2,
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
    allowDraws: false,
    meetingsPerPair: 1,
    ...overrides,
  };
}

describe('GroupStageGenerator', () => {
  const generator = new GroupStageGenerator(new RoundRobinGenerator());

  it.each([
    [8, 2, 4, 6],
    [16, 4, 4, 6],
  ])(
    'allocates %i teams into %i groups and generates round-robin matches',
    (teamCount, numGroups, teamsPerGroup, matchesPerGroup) => {
      const groupSettings = settings({ numberOfGroups: numGroups });
      const allocations = generator.allocate(
        input(teams(teamCount), groupSettings),
      );
      const matches = generator.generate(
        input(teams(teamCount), groupSettings),
      );

      expect(allocations).toHaveLength(numGroups);
      expect(
        allocations.every((group) => group.teams.length === teamsPerGroup),
      ).toBe(true);
      for (const group of allocations) {
        expect(
          matches.filter((match) => match.group?.key === group.key),
        ).toHaveLength(matchesPerGroup);
      }
      expect(matches).toHaveLength(numGroups * matchesPerGroup);
    },
  );

  it('uses snake allocation for seeded teams', () => {
    const allocations = generator.allocate(
      input(teams(8).reverse(), settings()),
    );

    expect(
      allocations.map((group) => group.teams.map((team) => team.seed)),
    ).toEqual([
      [1, 4, 5, 8],
      [2, 3, 6, 7],
    ]);
  });

  it('sorts unseeded teams by registeredAt before snake allocation', () => {
    const unseeded = teams(8)
      .map((team) => ({ ...team, seed: null }))
      .reverse();
    const allocations = generator.allocate(input(unseeded, settings()));

    expect(
      allocations.map((group) => group.teams.map((team) => team.id)),
    ).toEqual([
      ['team-1', 'team-4', 'team-5', 'team-8'],
      ['team-2', 'team-3', 'team-6', 'team-7'],
    ]);
  });

  it.each([
    [8, 3, 'cannot be divided'],
    [4, 5, 'cannot exceed'],
    [8, 2, 'less than teamsPerGroup'],
  ])(
    'rejects invalid allocation for %i teams and %i groups',
    (teamCount, numberOfGroups, message) => {
      expect(() =>
        generator.generate(
          input(
            teams(teamCount),
            settings({
              numberOfGroups,
              ...(teamCount === 8 && numberOfGroups === 2
                ? { advancingTeamsPerGroup: 4 }
                : {}),
            }),
          ),
        ),
      ).toThrow(message);
    },
  );

  it('reuses double round-robin behavior inside every group', () => {
    const matches = generator.generate(
      input(teams(8), settings({ meetingsPerPair: 2 })),
    );

    expect(matches).toHaveLength(24);
    expect(
      matches.filter((match) => match.group?.key === 'group-1'),
    ).toHaveLength(12);
  });

  it('associates every draft with deterministic group context', () => {
    const matches = generator.generate(input(teams(8), settings()));

    expect(matches.every((match) => match.group !== undefined)).toBe(true);
    expect(new Set(matches.map((match) => match.key)).size).toBe(
      matches.length,
    );
  });

  it.each([
    [8, 2, 1, 12],
    [8, 2, 2, 24],
    [16, 4, 1, 24],
  ])(
    'generates every pair exactly %i time(s) without cross-group matches',
    (teamCount, numberOfGroups, meetingsPerPair, expectedMatches) => {
      const tournamentTeams = teams(teamCount);
      const groupSettings = settings({ numberOfGroups, meetingsPerPair });
      const allocations = generator.allocate(
        input(tournamentTeams, groupSettings),
      );
      const matches = generator.generate(input(tournamentTeams, groupSettings));
      const groupByTeam = new Map(
        allocations.flatMap((group) =>
          group.teams.map((team) => [team.id, group.key] as const),
        ),
      );
      const pairCounts = new Map<string, number>();

      expect(matches).toHaveLength(expectedMatches);
      for (const match of matches) {
        const teamAId = match.teamA.teamId!;
        const teamBId = match.teamB.teamId!;
        expect(teamAId).not.toBe(teamBId);
        expect(groupByTeam.get(teamAId)).toBe(groupByTeam.get(teamBId));
        const pair = [teamAId, teamBId].sort().join(':');
        pairCounts.set(pair, (pairCounts.get(pair) ?? 0) + 1);
      }
      expect(
        [...pairCounts.values()].every((count) => count === meetingsPerPair),
      ).toBe(true);
    },
  );
});
