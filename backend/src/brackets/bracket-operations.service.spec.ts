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
