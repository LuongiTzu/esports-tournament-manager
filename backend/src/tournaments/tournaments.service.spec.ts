/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MatchStatus,
  RoundStatus,
  TournamentMode,
  TournamentStatus,
} from '@prisma/client';
import { RoundSettingsService } from '../brackets/round-settings.service';
import { StandingsService } from '../brackets/standings.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import { TournamentsService } from './tournaments.service';

function harness(total = 45) {
  const findMany = jest.fn().mockResolvedValue([]);
  const prisma = {
    tournament: {
      findMany,
      count: jest.fn().mockResolvedValue(total),
    },
  } as unknown as PrismaService;
  return {
    service: new TournamentsService(
      prisma,
      {} as RoundSettingsService,
      {} as StandingsService,
      {} as ContentFilterService,
    ),
    findMany,
  };
}

describe('TournamentsService public listing', () => {
  it('builds all supported filters including tournament/game search', async () => {
    const { service, findMany } = harness();

    await service.findAllPublic({
      search: 'valorant',
      gameId: 'game-1',
      status: TournamentStatus.ONGOING,
      mode: TournamentMode.ONLINE,
      isVerified: 'true',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        // Jest asymmetric matchers are intentionally used for Prisma's nested filter.
        where: expect.objectContaining({
          visibility: 'PUBLIC',
          moderationStatus: 'ACTIVE',
          gameId: 'game-1',
          status: TournamentStatus.ONGOING,
          mode: TournamentMode.ONLINE,
          isVerified: true,
          OR: [
            { name: { contains: 'valorant', mode: 'insensitive' } },
            {
              game: {
                name: { contains: 'valorant', mode: 'insensitive' },
              },
            },
          ],
        }),
      }),
    );
  });

  it('applies bounded pagination and reports totals', async () => {
    const { service, findMany } = harness(101);

    await expect(
      service.findAllPublic({ page: 3, limit: 20 }),
    ).resolves.toEqual({
      data: [],
      pagination: { page: 3, limit: 20, total: 101, totalPages: 6 },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 40, take: 20 }),
    );
  });

  it('sorts verified tournaments first and then by start date', async () => {
    const { service, findMany } = harness();

    await service.findAllPublic({});

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [
          { isVerified: 'desc' },
          { startDate: 'asc' },
          { createdAt: 'desc' },
        ],
      }),
    );
  });
});

describe('TournamentsService deletion lifecycle', () => {
  function deletionHarness(
    tournament: {
      id: string;
      status: TournamentStatus;
      startDate: Date | null;
    } | null = {
      id: 'tournament-1',
      status: TournamentStatus.REGISTRATION,
      startDate: new Date('2099-01-01T00:00:00.000Z'),
    },
    startedRounds = 0,
    startedMatches = 0,
  ) {
    const tx = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue(tournament),
        delete: jest.fn().mockResolvedValue({ id: 'tournament-1' }),
      },
      round: { count: jest.fn().mockResolvedValue(startedRounds) },
      match: { count: jest.fn().mockResolvedValue(startedMatches) },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    return {
      service: new TournamentsService(
        prisma,
        {} as RoundSettingsService,
        {} as StandingsService,
        {} as ContentFilterService,
      ),
      prisma,
      tx,
    };
  }

  it.each([TournamentStatus.DRAFT, TournamentStatus.REGISTRATION])(
    'deletes a fresh %s tournament atomically',
    async (status) => {
      const { service, prisma, tx } = deletionHarness({
        id: 'tournament-1',
        status,
        startDate: new Date('2099-01-01T00:00:00.000Z'),
      });

      await expect(service.remove('tournament-1')).resolves.toEqual({
        message: 'Đã xóa giải đấu thành công',
      });
      expect(tx.tournament.delete).toHaveBeenCalledWith({
        where: { id: 'tournament-1' },
      });
      expect(prisma.$transaction).toHaveBeenCalled();
    },
  );

  it('rejects a missing tournament', async () => {
    const { service, tx } = deletionHarness(null);

    await expect(service.remove('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.tournament.delete).not.toHaveBeenCalled();
  });

  it.each([TournamentStatus.ONGOING, TournamentStatus.COMPLETED])(
    'does not delete a protected %s tournament',
    async (status) => {
      const { service, tx } = deletionHarness({
        id: 'tournament-1',
        status,
        startDate: null,
      });

      await expect(service.remove('tournament-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tx.tournament.delete).not.toHaveBeenCalled();
    },
  );

  it('does not delete a tournament whose scheduled start has passed', async () => {
    const { service, tx } = deletionHarness({
      id: 'tournament-1',
      status: TournamentStatus.REGISTRATION,
      startDate: new Date('2000-01-01T00:00:00.000Z'),
    });

    await expect(service.remove('tournament-1')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(tx.tournament.delete).not.toHaveBeenCalled();
  });

  it.each([
    ['started round', 1, 0],
    ['played match', 0, 1],
  ] as const)(
    'does not partially delete a tournament with a %s',
    async (_, rounds, matches) => {
      const { service, tx } = deletionHarness(
        {
          id: 'tournament-1',
          status: TournamentStatus.CANCELLED,
          startDate: new Date('2099-01-01T00:00:00.000Z'),
        },
        rounds,
        matches,
      );

      await expect(service.remove('tournament-1')).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(tx.tournament.delete).not.toHaveBeenCalled();
      expect(tx.round.count).toHaveBeenCalledWith({
        where: {
          tournamentId: 'tournament-1',
          status: { in: [RoundStatus.ONGOING, RoundStatus.COMPLETED] },
        },
      });
      expect(tx.match.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              {
                status: {
                  in: [MatchStatus.ONGOING, MatchStatus.COMPLETED],
                },
              },
            ]),
          }) as object,
        }),
      );
    },
  );
});
