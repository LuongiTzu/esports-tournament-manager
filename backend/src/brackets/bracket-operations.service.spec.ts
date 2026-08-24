/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  MatchActivationCondition,
  MatchStatus,
  RoundFormat,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { BracketOperationsService } from './bracket-operations.service';
import { BracketsService } from './brackets.service';
import { StandingsService } from './standings.service';
import { RoundSettingsService } from './round-settings.service';

const PUBLIC_TEAM_SELECT_FOR_TEST = {
  id: true,
  name: true,
  shortName: true,
  logoUrl: true,
  seed: true,
};

function round(
  matches: unknown[] = [],
  format: RoundFormat = RoundFormat.PLAYOFF,
) {
  return {
    id: 'round-1',
    tournamentId: 'tournament-1',
    format,
    settings: { thirdPlaceMatch: false },
    bestOf: 3,
    _count: { groups: 0 },
    matches,
  };
}

function pendingMatch(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1',
    status: MatchStatus.PENDING,
    scoreA: 0,
    scoreB: 0,
    winnerTeamId: null,
    playedAt: null,
    _count: { scores: 0 },
    ...overrides,
  };
}

function harness(roundValue: ReturnType<typeof round>, teamCount = 4) {
  const teams = Array.from({ length: teamCount }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    seed: index + 1,
    registeredAt: new Date(2026, 0, index + 1),
  }));
  const tx = {
    round: { findUnique: jest.fn().mockResolvedValue(roundValue) },
    team: { findMany: jest.fn().mockResolvedValue(teams) },
    match: {
      deleteMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    group: { deleteMany: jest.fn(), create: jest.fn() },
    groupTeam: { createMany: jest.fn() },
    roundTeam: { findMany: jest.fn().mockResolvedValue([]) },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  const brackets = {
    generate: jest.fn().mockResolvedValue([]),
  } as unknown as BracketsService;
  const service = new BracketOperationsService(
    prisma,
    brackets,
    {} as StandingsService,
    new RoundSettingsService(),
  );
  return { service, tx, brackets, teams };
}

describe('BracketOperationsService generation', () => {
  it('rejects duplicate generation without force', async () => {
    const { service } = harness(round([pendingMatch()]));

    await expect(service.generate('round-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('protects score data even when force is requested', async () => {
    const { service, tx } = harness(round([pendingMatch({ scoreA: 1 })]));

    await expect(service.generate('round-1', true)).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.match.deleteMany).not.toHaveBeenCalled();
  });

  it('force-replaces only pending scoreless generated data', async () => {
    const { service, tx, brackets, teams } = harness(round([pendingMatch()]));

    await service.generate('round-1', true);

    expect(tx.match.deleteMany).toHaveBeenCalledWith({
      where: { roundId: 'round-1' },
    });
    expect(tx.group.deleteMany).toHaveBeenCalledWith({
      where: { roundId: 'round-1' },
    });
    expect(brackets.generate).toHaveBeenCalledWith(
      expect.objectContaining({ teams, format: RoundFormat.PLAYOFF }),
    );
  });

  it('loads only APPROVED teams', async () => {
    const { service, tx } = harness(round());

    await service.generate('round-1');

    expect(tx.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'APPROVED' }),
      }),
    );
  });

  it('uses persisted round participants instead of all tournament teams', async () => {
    const { service, tx, brackets, teams } = harness(round());
    tx.roundTeam.findMany.mockResolvedValue([
      {
        team: {
          ...teams[1],
          tournamentId: 'tournament-1',
          status: 'APPROVED',
        },
      },
      {
        team: {
          ...teams[3],
          tournamentId: 'tournament-1',
          status: 'APPROVED',
        },
      },
    ] as never);

    await service.generate('round-1');

    expect(brackets.generate).toHaveBeenCalledWith(
      expect.objectContaining({ teams: [teams[1], teams[3]] }),
    );
    expect(tx.team.findMany).not.toHaveBeenCalled();
  });

  it('rejects invalid approved team count', async () => {
    const { service } = harness(round([], RoundFormat.DOUBLE_ELIM), 3);

    await expect(service.generate('round-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('persists a conditional Grand Final Reset as inactive and links both results to it', async () => {
    const { service, tx, brackets } = harness(
      round([], RoundFormat.DOUBLE_ELIM),
    );
    brackets.generate = jest.fn().mockResolvedValue([
      {
        key: 'grand-final',
        bracketRound: 3,
        bracketType: null,
        matchNumber: 1,
        matchKind: 'GRAND_FINAL',
        teamA: { teamId: null },
        teamB: { teamId: null },
        nextMatchKey: 'grand-final-reset',
        nextMatchSlot: 'A',
        loserNextMatchKey: 'grand-final-reset',
        loserNextMatchSlot: 'B',
        isBye: false,
        bestOf: 3,
      },
      {
        key: 'grand-final-reset',
        bracketRound: 4,
        bracketType: null,
        matchNumber: 1,
        matchKind: 'GRAND_FINAL_RESET',
        teamA: {
          teamId: null,
          sourceMatchKey: 'grand-final',
          sourceResult: 'WINNER',
        },
        teamB: {
          teamId: null,
          sourceMatchKey: 'grand-final',
          sourceResult: 'LOSER',
        },
        nextMatchKey: null,
        nextMatchSlot: null,
        loserNextMatchKey: null,
        loserNextMatchSlot: null,
        activationCondition:
          MatchActivationCondition.LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL,
        isBye: false,
        bestOf: 3,
      },
    ] as never);
    tx.match.create.mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: data.activationCondition ? 'reset-db' : 'grand-final-db',
        ...data,
      }),
    );

    await service.generate('round-1');

    expect(tx.match.create).toHaveBeenCalledTimes(2);
    expect(tx.match.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        isActive: false,
        activationCondition:
          MatchActivationCondition.LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL,
      }),
    });
    expect(tx.match.update).toHaveBeenCalledWith({
      where: { id: 'grand-final-db' },
      data: expect.objectContaining({
        nextMatchId: 'reset-db',
        nextMatchSlot: 'A',
        loserNextMatchId: 'reset-db',
        loserNextMatchSlot: 'B',
      }),
    });
  });

  it('propagates a seeded bye winner into the downstream bracket slot', async () => {
    const { service, tx, brackets } = harness(round(), 3);
    brackets.generate = jest.fn().mockResolvedValue([
      {
        key: 'bye',
        bracketRound: 1,
        bracketType: null,
        matchNumber: 1,
        teamA: { teamId: 'team-1' },
        teamB: { teamId: null },
        nextMatchKey: 'final',
        nextMatchSlot: 'A',
        loserNextMatchKey: null,
        loserNextMatchSlot: null,
        isBye: true,
        bestOf: 3,
      },
      {
        key: 'final',
        bracketRound: 2,
        bracketType: null,
        matchNumber: 1,
        teamA: { teamId: null },
        teamB: { teamId: null },
        nextMatchKey: null,
        nextMatchSlot: null,
        loserNextMatchKey: null,
        loserNextMatchSlot: null,
        isBye: false,
        bestOf: 3,
      },
    ] as never);
    tx.match.create.mockImplementation(({ data }: any) =>
      Promise.resolve({
        id: data.isBye ? 'bye-db' : 'final-db',
        ...data,
      }),
    );

    await service.generate('round-1');

    expect(tx.match.update).toHaveBeenCalledWith({
      where: { id: 'final-db' },
      data: { teamAId: 'team-1' },
    });
  });

  it('returns normalized bracket slots and linkage shape', async () => {
    const prisma = {
      round: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'round-1',
          name: 'Playoff',
          format: RoundFormat.PLAYOFF,
          status: 'UPCOMING',
          bestOf: 3,
          settings: { thirdPlaceMatch: false },
          groups: [],
          matches: [
            {
              id: 'match-1',
              groupId: 'group-a',
              bracketRound: 1,
              bracketType: null,
              matchNumber: 1,
              status: MatchStatus.PENDING,
              outcome: null,
              isBye: false,
              bestOf: 3,
              scheduledAt: null,
              teamA: {
                id: 'team-1',
                name: 'Team One',
                shortName: 'ONE',
                logoUrl: null,
                seed: 1,
                contactEmail: 'private@example.com',
                rejectReason: 'private moderation data',
              },
              teamB: {
                id: 'team-2',
                name: 'Team Two',
                shortName: null,
                logoUrl: null,
                seed: 2,
              },
              scoreA: 0,
              scoreB: 0,
              winner: null,
              nextMatchId: 'match-2',
              nextMatchSlot: 'A',
              loserNextMatchId: null,
              loserNextMatchSlot: null,
            },
          ],
        }),
      },
    } as unknown as PrismaService;
    const service = new BracketOperationsService(
      prisma,
      {} as BracketsService,
      {} as StandingsService,
      new RoundSettingsService(),
    );

    const result = await service.getBracket('round-1');
    expect(result).toEqual(
      expect.objectContaining({
        round: expect.objectContaining({ format: RoundFormat.PLAYOFF }),
        groups: [],
        matches: [
          expect.objectContaining({
            groupId: 'group-a',
            slots: {
              A: {
                id: 'team-1',
                name: 'Team One',
                shortName: 'ONE',
                logoUrl: null,
                seed: 1,
              },
              B: {
                id: 'team-2',
                name: 'Team Two',
                shortName: null,
                logoUrl: null,
                seed: 2,
              },
            },
            status: MatchStatus.PENDING,
            outcome: null,
            isBye: false,
            nextMatch: { id: 'match-2', slot: 'A' },
            loserNextMatch: { id: null, slot: null },
          }),
        ],
      }),
    );
    expect(result.matches[0].slots.A).not.toHaveProperty('contactEmail');
    expect(result.matches[0].slots.A).not.toHaveProperty('rejectReason');
    expect(prisma.round.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          groups: expect.objectContaining({
            include: {
              teamAssignments: {
                include: {
                  team: { select: PUBLIC_TEAM_SELECT_FOR_TEST },
                },
              },
            },
          }),
          matches: expect.objectContaining({
            include: {
              teamA: { select: PUBLIC_TEAM_SELECT_FOR_TEST },
              teamB: { select: PUBLIC_TEAM_SELECT_FOR_TEST },
              winner: { select: PUBLIC_TEAM_SELECT_FOR_TEST },
            },
          }),
        }),
      }),
    );
  });

  it('returns legacy Swiss settings in the canonical API shape', async () => {
    const prisma = {
      round: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'swiss-round',
          name: 'Swiss stage',
          format: RoundFormat.SWISS,
          status: 'UPCOMING',
          bestOf: 3,
          settings: {
            numRounds: 5,
            advanceCount: 4,
            pointsWin: 3,
            pointsDraw: 1,
            pointsLoss: 0,
            tiebreakers: ['BUCHHOLZ'],
          },
          groups: [],
          matches: [],
        }),
      },
    } as unknown as PrismaService;
    const service = new BracketOperationsService(
      prisma,
      {} as BracketsService,
      {} as StandingsService,
      new RoundSettingsService(),
    );

    await expect(service.getBracket('swiss-round')).resolves.toEqual(
      expect.objectContaining({
        round: expect.objectContaining({
          format: RoundFormat.SWISS,
          settings: { numberOfRounds: 5, advancingTeamCount: 4 },
        }),
      }),
    );
  });
});

describe('BracketOperationsService group advancement', () => {
  function advanceHarness(
    groupCount = 2,
    advanceCount = 2,
    overrides: Record<string, unknown> = {},
  ) {
    const roundValue: any = {
      id: 'round-1',
      tournamentId: 'tournament-1',
      orderIndex: 1,
      format: RoundFormat.GROUP_STAGE,
      settings: {
        numberOfGroups: groupCount,
        advancingTeamsPerGroup: advanceCount,
        winPoints: 3,
        drawPoints: 1,
        lossPoints: 0,
        allowDraws: false,
        meetingsPerPair: 1,
      },
      matches: Array.from({ length: groupCount }, (_, index) =>
        Array.from({ length: 6 }, () => ({
          status: MatchStatus.COMPLETED,
          groupId: `group-${String.fromCharCode(97 + index)}`,
        })),
      ).flat(),
      ...overrides,
    };
    const participants: Array<{
      roundId: string;
      teamId: string;
      advancedFromRoundId: string;
    }> = [];
    const nextRound = {
      id: 'round-2',
      name: 'Playoff',
      format: RoundFormat.PLAYOFF,
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'round-1' }]),
      round: {
        findUnique: jest.fn().mockImplementation(() =>
          Promise.resolve({
            id: roundValue.id,
            tournamentId: roundValue.tournamentId,
            orderIndex: roundValue.orderIndex,
            format: roundValue.format,
            matches: roundValue.matches.map((match: any) => ({
              status: match.status,
            })),
          }),
        ),
        findFirst: jest.fn().mockResolvedValue(nextRound),
      },
      roundTeam: {
        findFirst: jest
          .fn()
          .mockImplementation(() =>
            Promise.resolve(participants.length ? participants[0] : null),
          ),
        createMany: jest.fn().mockImplementation(({ data }) => {
          participants.push(...data);
          return Promise.resolve({ count: data.length });
        }),
        findMany: jest.fn().mockImplementation(() =>
          Promise.resolve(
            participants.map((participant) => ({
              team: {
                id: participant.teamId,
                name: participant.teamId.toUpperCase(),
                seed: null,
              },
            })),
          ),
        ),
      },
      team: {
        findMany: jest
          .fn()
          .mockImplementation(({ where }) =>
            Promise.resolve((where.id.in as string[]).map((id) => ({ id }))),
          ),
      },
    };
    const prisma = {
      round: {
        findUnique: jest.fn().mockResolvedValue(roundValue),
        findFirst: jest.fn().mockResolvedValue(nextRound),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const standings = {
      forTournament: jest.fn().mockResolvedValue({
        rounds: [
          {
            standings: Array.from({ length: groupCount }, (_, index) => ({
              groupId: `group-${String.fromCharCode(97 + index)}`,
              name: `Group ${String.fromCharCode(65 + index)}`,
              orderIndex: index + 1,
              standings: Array.from({ length: 4 }, (_, teamIndex) => ({
                id: `${String.fromCharCode(97 + index)}${teamIndex + 1}`,
              })),
            })),
          },
        ],
      }),
    } as unknown as StandingsService;
    return {
      service: new BracketOperationsService(
        prisma,
        {} as BracketsService,
        standings,
        new RoundSettingsService(),
      ),
      roundValue,
      participants,
      tx,
    };
  }

  it('qualifies exactly advanceCount teams independently from each group', async () => {
    const { service, participants } = advanceHarness();

    const result: any = await service.advance('round-1');

    expect(result.advanceCount).toBe(4);
    expect(result.advanceCountPerGroup).toBe(2);
    expect(result.teamIds).toEqual(['a1', 'a2', 'b1', 'b2']);
    expect(result.groups).toEqual([
      expect.objectContaining({ groupId: 'group-a', teamIds: ['a1', 'a2'] }),
      expect.objectContaining({ groupId: 'group-b', teamIds: ['b1', 'b2'] }),
    ]);
    expect(result.persisted).toBe(true);
    expect(participants).toHaveLength(4);
    expect(new Set(participants.map((item) => item.teamId)).size).toBe(4);
  });

  it('qualifies two teams from each of four groups', async () => {
    const { service } = advanceHarness(4, 2);

    const result: any = await service.advance('round-1');

    expect(result.advanceCount).toBe(8);
    expect(result.teamIds).toEqual([
      'a1',
      'a2',
      'b1',
      'b2',
      'c1',
      'c2',
      'd1',
      'd2',
    ]);
  });

  it('qualifies one team from each group when configured', async () => {
    const { service } = advanceHarness(2, 1);

    const result: any = await service.advance('round-1');

    expect(result.advanceCount).toBe(2);
    expect(result.advanceCountPerGroup).toBe(1);
    expect(result.teamIds).toEqual(['a1', 'b1']);
  });

  it('blocks advancement when any group match is incomplete', async () => {
    const { service, roundValue } = advanceHarness();
    roundValue.matches[6].status = MatchStatus.PENDING;

    await expect(service.advance('round-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an advance count larger than a group capacity', async () => {
    const { service, roundValue } = advanceHarness();
    (roundValue.settings as Record<string, unknown>).advancingTeamsPerGroup = 5;

    await expect(service.advance('round-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects invalid group settings', async () => {
    const { service, roundValue } = advanceHarness();
    (roundValue.settings as Record<string, unknown>).numberOfGroups = 0;

    await expect(service.advance('round-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('blocks duplicate persisted advancement', async () => {
    const { service, tx, participants } = advanceHarness();

    await service.advance('round-1');
    await expect(service.advance('round-1')).rejects.toBeInstanceOf(
      ConflictException,
    );
    expect(tx.roundTeam.createMany).toHaveBeenCalledTimes(1);
    expect(participants).toHaveLength(4);
  });

  it('rolls back when participant persistence fails', async () => {
    const { service, tx, participants } = advanceHarness();
    tx.roundTeam.createMany.mockRejectedValueOnce(
      new Error('simulated advancement failure'),
    );

    await expect(service.advance('round-1')).rejects.toThrow(
      'simulated advancement failure',
    );
    expect(participants).toEqual([]);
  });
});

describe('BracketOperationsService format-specific advancement', () => {
  function harnessFor(
    format: RoundFormat,
    settings: Record<string, unknown>,
    standingsRows: Array<{ id?: string; teamId?: string }>,
    bracketRound = 1,
  ) {
    const matches: Array<{
      status: MatchStatus;
      isActive: boolean;
      groupId: null;
      bracketRound: number;
    }> = [
      {
        status: MatchStatus.COMPLETED,
        isActive: true,
        groupId: null,
        bracketRound,
      },
    ];
    const current = {
      id: 'round-1',
      tournamentId: 'tournament-1',
      orderIndex: 1,
      format,
      settings,
      matches,
    };
    const next = {
      id: 'round-2',
      name: 'Next Round',
      format: RoundFormat.PLAYOFF,
    };
    const participants: string[] = [];
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'round-1' }]),
      round: {
        findUnique: jest.fn().mockResolvedValue(current),
        findFirst: jest.fn().mockResolvedValue(next),
      },
      roundTeam: {
        findFirst: jest.fn().mockResolvedValue(null),
        createMany: jest.fn().mockImplementation(({ data }) => {
          participants.push(...data.map((item: any) => item.teamId));
          return { count: data.length };
        }),
        findMany: jest.fn().mockImplementation(() =>
          participants.map((teamId) => ({
            team: { id: teamId, name: teamId, seed: null },
          })),
        ),
      },
      team: {
        findMany: jest
          .fn()
          .mockImplementation(({ where }) =>
            (where.id.in as string[]).map((id) => ({ id })),
          ),
      },
    };
    const prisma = {
      round: {
        findUnique: jest.fn().mockResolvedValue(current),
        findFirst: jest.fn().mockResolvedValue(next),
      },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const standings = {
      forTournament: jest.fn().mockResolvedValue({
        rounds: [{ standings: standingsRows }],
      }),
    } as unknown as StandingsService;
    return {
      service: new BracketOperationsService(
        prisma,
        {} as BracketsService,
        standings,
        new RoundSettingsService(),
      ),
      participants,
      current,
    };
  }

  it('persists configured Round Robin qualifiers', async () => {
    const { service, participants } = harnessFor(
      RoundFormat.ROUND_ROBIN,
      { advanceCount: 2, pointsWin: 3, pointsDraw: 1, pointsLoss: 0 },
      [{ id: 'rr-1' }, { id: 'rr-2' }, { id: 'rr-3' }],
    );

    const result = await service.advance('round-1');

    expect(result.persisted).toBe(true);
    expect(participants).toEqual(['rr-1', 'rr-2']);
  });

  it('persists Swiss qualifiers only after the final configured Swiss round', async () => {
    const final = harnessFor(
      RoundFormat.SWISS,
      { advancingTeamCount: 2, numberOfRounds: 3 },
      [{ teamId: 'swiss-1' }, { teamId: 'swiss-2' }, { teamId: 'swiss-3' }],
      3,
    );

    await expect(final.service.advance('round-1')).resolves.toEqual(
      expect.objectContaining({ persisted: true, advanceCount: 2 }),
    );
    expect(final.participants).toEqual(['swiss-1', 'swiss-2']);

    const early = harnessFor(
      RoundFormat.SWISS,
      { advancingTeamCount: 2, numberOfRounds: 3 },
      [{ teamId: 'swiss-1' }, { teamId: 'swiss-2' }],
      2,
    );
    await expect(early.service.advance('round-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('uses the derived Swiss round limit when numberOfRounds is automatic', async () => {
    const automatic = harnessFor(
      RoundFormat.SWISS,
      { advancingTeamCount: 2, numberOfRounds: null },
      Array.from({ length: 8 }, (_, index) => ({
        teamId: `swiss-${index + 1}`,
      })),
      3,
    );

    await expect(automatic.service.advance('round-1')).resolves.toEqual(
      expect.objectContaining({ persisted: true, advanceCount: 2 }),
    );
    expect(automatic.participants).toEqual(['swiss-1', 'swiss-2']);
  });

  it.each([RoundFormat.PLAYOFF, RoundFormat.DOUBLE_ELIM])(
    'keeps %s progression match-linkage driven',
    async (format) => {
      const { service, participants } = harnessFor(format, {}, []);

      await expect(service.advance('round-1')).resolves.toEqual(
        expect.objectContaining({
          persisted: true,
          progressionMode: 'MATCH_LINKAGE',
          nextRound: null,
        }),
      );
      expect(participants).toEqual([]);
    },
  );

  it('does not treat an inactive Grand Final Reset as unfinished', async () => {
    const { service, current } = harnessFor(
      RoundFormat.DOUBLE_ELIM,
      { grandFinalReset: true },
      [],
    );
    current.matches.push({
      status: MatchStatus.PENDING,
      isActive: false,
      groupId: null,
      bracketRound: 2,
    });

    await expect(service.advance('round-1')).resolves.toEqual(
      expect.objectContaining({ progressionMode: 'MATCH_LINKAGE' }),
    );
  });
});
