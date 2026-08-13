import { TournamentMode, TournamentStatus } from '@prisma/client';
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
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
