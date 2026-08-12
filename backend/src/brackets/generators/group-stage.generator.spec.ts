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

describe('GroupStageGenerator', () => {
  const generator = new GroupStageGenerator(new RoundRobinGenerator());

  it.each([
    [8, 2, 4, 6],
    [12, 3, 4, 6],
  ])(
    'allocates %i teams into %i groups and generates round-robin matches',
    (teamCount, numGroups, teamsPerGroup, matchesPerGroup) => {
      const settings = {
        numGroups,
        teamsPerGroup,
        advanceCount: 2,
        doubleRound: false,
      };
      const allocations = generator.allocate(input(teams(teamCount), settings));
      const matches = generator.generate(input(teams(teamCount), settings));

      expect(allocations).toHaveLength(numGroups);
      expect(allocations.every((group) => group.teams.length === 4)).toBe(true);
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
      input(teams(8).reverse(), {
        numGroups: 2,
        teamsPerGroup: 4,
        advanceCount: 2,
        doubleRound: false,
      }),
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
    const allocations = generator.allocate(
      input(unseeded, {
        numGroups: 2,
        teamsPerGroup: 4,
        advanceCount: 2,
        doubleRound: false,
      }),
    );

    expect(
      allocations.map((group) => group.teams.map((team) => team.id)),
    ).toEqual([
      ['team-1', 'team-4', 'team-5', 'team-8'],
      ['team-2', 'team-3', 'team-6', 'team-7'],
    ]);
  });

  it('rejects uneven or incomplete group capacity', () => {
    expect(() =>
      generator.generate(
        input(teams(7), {
          numGroups: 2,
          teamsPerGroup: 4,
          advanceCount: 2,
          doubleRound: false,
        }),
      ),
    ).toThrow('exactly 8 approved teams');
  });

  it('reuses double round-robin behavior inside every group', () => {
    const matches = generator.generate(
      input(teams(8), {
        numGroups: 2,
        teamsPerGroup: 4,
        advanceCount: 2,
        doubleRound: true,
      }),
    );

    expect(matches).toHaveLength(24);
    expect(
      matches.filter((match) => match.group?.key === 'group-1'),
    ).toHaveLength(12);
  });

  it('associates every draft with deterministic group context', () => {
    const matches = generator.generate(
      input(teams(8), {
        numGroups: 2,
        teamsPerGroup: 4,
        advanceCount: 2,
        doubleRound: false,
      }),
    );

    expect(matches.every((match) => match.group !== undefined)).toBe(true);
    expect(new Set(matches.map((match) => match.key)).size).toBe(
      matches.length,
    );
  });
});
