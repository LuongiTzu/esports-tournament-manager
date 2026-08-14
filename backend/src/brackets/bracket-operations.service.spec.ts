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

function round(
  matches: unknown[] = [],
  format: RoundFormat = RoundFormat.PLAYOFF,
) {
  return {
    id: 'round-1',
    tournamentId: 'tournament-1',
    format,
    settings: { seeding: 'STANDARD', thirdPlaceMatch: false },
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
              bracketRound: 1,
              bracketType: null,
              matchNumber: 1,
              status: MatchStatus.PENDING,
              isBye: false,
              bestOf: 3,
              teamA: { id: 'team-1' },
              teamB: { id: 'team-2' },
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
    );

    await expect(service.getBracket('round-1')).resolves.toEqual(
      expect.objectContaining({
        round: expect.objectContaining({ format: RoundFormat.PLAYOFF }),
        groups: [],
        matches: [
          expect.objectContaining({
            slots: { A: { id: 'team-1' }, B: { id: 'team-2' } },
            status: MatchStatus.PENDING,
            isBye: false,
            nextMatch: { id: 'match-2', slot: 'A' },
            loserNextMatch: { id: null, slot: null },
          }),
        ],
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
        numGroups: groupCount,
        teamsPerGroup: 4,
        advanceCount,
        doubleRound: false,
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

  it('blocks advancement when any group match is incomplete', async () => {
    const { service, roundValue } = advanceHarness();
    roundValue.matches[6].status = MatchStatus.PENDING;

    await expect(service.advance('round-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects an advance count larger than a group capacity', async () => {
    const { service, roundValue } = advanceHarness();
    (roundValue.settings as Record<string, unknown>).advanceCount = 5;

    await expect(service.advance('round-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects invalid group settings', async () => {
    const { service, roundValue } = advanceHarness();
    (roundValue.settings as Record<string, unknown>).numGroups = 0;

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
    const matches = [
      {
        status: MatchStatus.COMPLETED,
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
      ),
      participants,
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
      { advanceCount: 2, numRounds: 3 },
      [{ teamId: 'swiss-1' }, { teamId: 'swiss-2' }, { teamId: 'swiss-3' }],
      3,
    );

    await expect(final.service.advance('round-1')).resolves.toEqual(
      expect.objectContaining({ persisted: true, advanceCount: 2 }),
    );
    expect(final.participants).toEqual(['swiss-1', 'swiss-2']);

    const early = harnessFor(
      RoundFormat.SWISS,
      { advanceCount: 2, numRounds: 3 },
      [{ teamId: 'swiss-1' }, { teamId: 'swiss-2' }],
      2,
    );
    await expect(early.service.advance('round-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
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
});
