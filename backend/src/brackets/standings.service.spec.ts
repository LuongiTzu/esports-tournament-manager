import { MatchOutcome, RoundFormat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StandingsService } from './standings.service';
import { SwissService } from './swiss.service';
import { RoundSettingsService } from './round-settings.service';

describe('StandingsService', () => {
  it('keeps group standings separate and applies configured points and tiebreaks', async () => {
    const prisma = {
      roundTeam: { findMany: jest.fn().mockResolvedValue([]) },
      group: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'g-a',
            name: 'Group A',
            orderIndex: 1,
            teamAssignments: [
              { team: { id: 'a1', name: 'A1', seed: 1 } },
              { team: { id: 'a2', name: 'A2', seed: 2 } },
            ],
          },
          {
            id: 'g-b',
            name: 'Group B',
            orderIndex: 2,
            teamAssignments: [
              { team: { id: 'b1', name: 'B1', seed: 3 } },
              { team: { id: 'b2', name: 'B2', seed: 4 } },
            ],
          },
        ]),
      },
      match: {
        findMany: jest.fn().mockResolvedValue([
          {
            groupId: 'g-a',
            teamAId: 'a1',
            teamBId: 'a2',
            scoreA: 1,
            scoreB: 0,
            winnerTeamId: 'a1',
            outcome: MatchOutcome.TEAM_A,
            isBye: false,
          },
          {
            groupId: 'g-b',
            teamAId: 'b1',
            teamBId: 'b2',
            scoreA: 2,
            scoreB: 2,
            winnerTeamId: null,
            outcome: MatchOutcome.DRAW,
            isBye: false,
          },
          // This cross-group match must not affect either group.
          {
            groupId: 'g-a',
            teamAId: 'b1',
            teamBId: 'a1',
            scoreA: 99,
            scoreB: 0,
            winnerTeamId: 'b1',
            outcome: MatchOutcome.TEAM_A,
            isBye: false,
          },
        ]),
      },
    } as unknown as PrismaService;
    const settings = {
      getEffectiveSettings: jest.fn().mockReturnValue({
        winPoints: 5,
        drawPoints: 2,
        lossPoints: 0,
        allowDraws: true,
        numberOfGroups: 2,
        advancingTeamsPerGroup: 1,
        meetingsPerPair: 1,
      }),
    } as unknown as RoundSettingsService;
    const service = new StandingsService(prisma, {} as SwissService, settings);

    const result = await service.forTournament('t-1', [
      {
        id: 'r-1',
        format: RoundFormat.GROUP_STAGE,
        settings: {
          winPoints: 5,
          drawPoints: 2,
          lossPoints: 0,
          allowDraws: true,
        },
      },
    ]);
    const groups = result.rounds[0].standings as Array<{
      groupId: string;
      standings: Array<{ id: string; points: number }>;
    }>;

    expect(groups).toHaveLength(2);
    expect(groups[0].standings.map((team) => team.id)).toEqual(['a1', 'a2']);
    expect(groups[0].standings[0].points).toBe(5);
    expect(groups[1].standings.map((team) => team.id)).toEqual(['b1', 'b2']);
    expect(groups[1].standings.map((team) => team.points)).toEqual([2, 2]);
  });

  it('calculates and sorts basic standings by wins and score difference', async () => {
    const prisma = {
      roundTeam: { findMany: jest.fn().mockResolvedValue([]) },
      team: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'a', name: 'A', seed: 2 },
          { id: 'b', name: 'B', seed: 1 },
        ]),
      },
      match: {
        findMany: jest.fn().mockResolvedValue([
          {
            teamAId: 'a',
            teamBId: 'b',
            scoreA: 2,
            scoreB: 0,
            winnerTeamId: 'a',
            outcome: MatchOutcome.TEAM_A,
            isBye: false,
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new StandingsService(
      prisma,
      {} as SwissService,
      new RoundSettingsService(),
    );

    const result = await service.forTournament('t-1', [
      { id: 'r-1', format: RoundFormat.ROUND_ROBIN },
    ]);

    expect(result.rounds[0].standings).toEqual([
      expect.objectContaining({
        id: 'a',
        rank: 1,
        wins: 1,
        points: 3,
        scoreDifference: 2,
      }),
      expect.objectContaining({
        id: 'b',
        rank: 2,
        losses: 1,
        points: 0,
        scoreDifference: -2,
      }),
    ]);
  });

  it('uses alternative Group Stage scoring instead of hardcoded 3/1/0', async () => {
    const prisma = {
      roundTeam: { findMany: jest.fn().mockResolvedValue([]) },
      group: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'g-a',
            name: 'Group A',
            orderIndex: 1,
            teamAssignments: [
              { team: { id: 'a', name: 'A', seed: 1 } },
              { team: { id: 'b', name: 'B', seed: 2 } },
              { team: { id: 'c', name: 'C', seed: 3 } },
            ],
          },
        ]),
      },
      match: {
        findMany: jest.fn().mockResolvedValue([
          {
            groupId: 'g-a',
            teamAId: 'a',
            teamBId: 'b',
            scoreA: 1,
            scoreB: 0,
            winnerTeamId: 'a',
            outcome: MatchOutcome.TEAM_A,
            isBye: false,
          },
          {
            groupId: 'g-a',
            teamAId: 'a',
            teamBId: 'c',
            scoreA: 0,
            scoreB: 0,
            winnerTeamId: null,
            outcome: MatchOutcome.DRAW,
            isBye: false,
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new StandingsService(
      prisma,
      {} as SwissService,
      new RoundSettingsService(),
    );

    const result = await service.forTournament('t-1', [
      {
        id: 'group-round',
        format: RoundFormat.GROUP_STAGE,
        settings: {
          numberOfGroups: 2,
          advancingTeamsPerGroup: 1,
          winPoints: 2,
          drawPoints: 0,
          lossPoints: 0,
          allowDraws: true,
          meetingsPerPair: 1,
        },
      },
    ]);
    const rows = (
      result.rounds[0].standings as Array<{
        standings: Array<{ id: string; points: number; draws: number }>;
      }>
    )[0].standings;

    expect(rows.map(({ id, points }) => [id, points])).toEqual([
      ['a', 2],
      ['c', 0],
      ['b', 0],
    ]);
    expect(rows[0].draws).toBe(1);
  });

  it('uses each round own win, draw and loss point settings', async () => {
    const prisma = {
      roundTeam: { findMany: jest.fn().mockResolvedValue([]) },
      team: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'a', name: 'A', seed: 1 },
          { id: 'b', name: 'B', seed: 2 },
          { id: 'c', name: 'C', seed: 3 },
        ]),
      },
      match: {
        findMany: jest.fn().mockResolvedValue([
          {
            teamAId: 'a',
            teamBId: 'b',
            scoreA: 2,
            scoreB: 0,
            winnerTeamId: 'a',
            outcome: MatchOutcome.TEAM_A,
            isBye: false,
          },
          {
            teamAId: 'a',
            teamBId: 'c',
            scoreA: 1,
            scoreB: 1,
            winnerTeamId: null,
            outcome: MatchOutcome.DRAW,
            isBye: false,
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new StandingsService(
      prisma,
      {} as SwissService,
      new RoundSettingsService(),
    );

    const result = await service.forTournament('t-1', [
      {
        id: 'r-custom',
        format: RoundFormat.ROUND_ROBIN,
        settings: {
          winPoints: 2,
          drawPoints: 1,
          lossPoints: 0,
          allowDraws: true,
          meetingsPerPair: 1,
        },
      },
      {
        id: 'r-default-draws',
        format: RoundFormat.ROUND_ROBIN,
        settings: { allowDraws: true },
      },
      {
        id: 'r-default',
        format: RoundFormat.ROUND_ROBIN,
      },
    ]);
    const custom = result.rounds[0].standings as Array<{
      id: string;
      points: number;
    }>;
    const defaultDraws = result.rounds[1].standings as Array<{
      id: string;
      points: number;
    }>;
    const defaults = result.rounds[2].standings as Array<{
      id: string;
      points: number;
    }>;

    expect(custom.map(({ id, points }) => [id, points])).toEqual([
      ['a', 3],
      ['c', 1],
      ['b', 0],
    ]);
    expect(defaultDraws.map(({ id, points }) => [id, points])).toEqual([
      ['a', 4],
      ['c', 1],
      ['b', 0],
    ]);
    expect(defaults.map(({ id, points }) => [id, points])).toEqual([
      ['a', 3],
      ['c', 0],
      ['b', 0],
    ]);
  });

  it('delegates Swiss standings to SwissService', async () => {
    const swiss = {
      calculateSwissStandings: jest.fn().mockResolvedValue([{ teamId: 'a' }]),
    } as unknown as SwissService;
    const prisma = {
      roundTeam: {
        findMany: jest.fn().mockResolvedValue([{ teamId: 'a', seed: 7 }]),
      },
      team: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'a',
            name: 'A',
            shortName: 'A',
            logoUrl: null,
            seed: 1,
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new StandingsService(
      prisma,
      swiss,
      new RoundSettingsService(),
    );

    const result = await service.forTournament('t-1', [
      { id: 'r-1', format: RoundFormat.SWISS },
    ]);

    expect(result.rounds[0].standings).toEqual([
      {
        teamId: 'a',
        team: {
          id: 'a',
          name: 'A',
          shortName: 'A',
          logoUrl: null,
          seed: 7,
        },
      },
    ]);
  });

  it.each([RoundFormat.PLAYOFF, RoundFormat.DOUBLE_ELIM])(
    'does not manufacture standings for %s',
    async (format) => {
      const service = new StandingsService(
        {} as PrismaService,
        {} as SwissService,
        new RoundSettingsService(),
      );

      const result = await service.forTournament('t-1', [
        { id: 'r-1', format },
      ]);

      expect(result.rounds[0].standings).toEqual([]);
    },
  );
});
