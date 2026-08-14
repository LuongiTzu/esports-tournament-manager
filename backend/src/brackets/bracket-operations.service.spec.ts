/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, ConflictException } from '@nestjs/common';
import { MatchStatus, RoundFormat } from '@prisma/client';
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

  it('rejects invalid approved team count', async () => {
    const { service } = harness(round([], RoundFormat.DOUBLE_ELIM), 3);

    await expect(service.generate('round-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
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
    const prisma = {
      round: {
        findUnique: jest.fn().mockResolvedValue(roundValue),
        findFirst: jest.fn().mockResolvedValue({
          id: 'round-2',
          name: 'Playoff',
          format: RoundFormat.PLAYOFF,
        }),
      },
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
    };
  }

  it('qualifies exactly advanceCount teams independently from each group', async () => {
    const { service } = advanceHarness();

    const result = await service.advance('round-1');

    expect(result.advanceCount).toBe(4);
    expect(result.advanceCountPerGroup).toBe(2);
    expect(result.teamIds).toEqual(['a1', 'a2', 'b1', 'b2']);
    expect(result.groups).toEqual([
      expect.objectContaining({ groupId: 'group-a', teamIds: ['a1', 'a2'] }),
      expect.objectContaining({ groupId: 'group-b', teamIds: ['b1', 'b2'] }),
    ]);
  });

  it('qualifies two teams from each of four groups', async () => {
    const { service } = advanceHarness(4, 2);

    const result = await service.advance('round-1');

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
});
