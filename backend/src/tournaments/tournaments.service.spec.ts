/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  MatchStatus,
  RoundFormat,
  RoundStatus,
  TournamentMode,
  TournamentStatus,
} from '@prisma/client';
import { RoundSettingsService } from '../brackets/round-settings.service';
import { StandingsService } from '../brackets/standings.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';

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

describe('TournamentsService round settings', () => {
  it('normalizes and persists settings during tournament creation', async () => {
    const tx = {
      tournament: {
        create: jest.fn().mockResolvedValue({ id: 'tournament-1' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'tournament-1',
          rounds: [],
        }),
      },
      round: { create: jest.fn().mockResolvedValue({ id: 'round-1' }) },
    };
    const prisma = {
      game: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'game-1',
          name: 'Test Game',
          defaultTeamSize: 5,
          maxTeamSize: 7,
        }),
      },
      tournament: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new TournamentsService(
      prisma,
      new RoundSettingsService(),
      {} as StandingsService,
      { validate: jest.fn() } as unknown as ContentFilterService,
    );

    await service.create('organizer-1', {
      name: 'Round Robin Cup',
      gameId: 'game-1',
      maxTeamSize: 7,
      rounds: [
        {
          name: 'League stage',
          format: RoundFormat.ROUND_ROBIN,
          bestOf: 3,
          settings: { meetingsPerPair: 2, allowDraws: true },
        },
        {
          name: 'Final stage',
          format: RoundFormat.PLAYOFF,
          bestOf: 5,
          settings: { seeding: 'STANDARD', thirdPlaceMatch: false },
        },
      ],
    });

    expect(tx.round.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        format: RoundFormat.ROUND_ROBIN,
        bestOf: 3,
        settings: {
          winPoints: 3,
          drawPoints: 1,
          lossPoints: 0,
          allowDraws: true,
          meetingsPerPair: 2,
        },
      }),
    });
    expect(tx.round.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        format: RoundFormat.PLAYOFF,
        bestOf: 5,
        settings: { thirdPlaceMatch: false },
      }),
    });
  });

  it('normalizes and persists settings through the add-round flow', async () => {
    const round = {
      findFirst: jest.fn().mockResolvedValue({ orderIndex: 2 }),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'round-3', ...data }),
        ),
    };
    const prisma = { round } as unknown as PrismaService;
    const service = new TournamentsService(
      prisma,
      new RoundSettingsService(),
      {} as StandingsService,
      {} as ContentFilterService,
    );
    const settings = {
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      allowDraws: true,
      meetingsPerPair: 2,
    };

    const result = await service.addRound('tournament-1', {
      name: 'League stage',
      format: RoundFormat.ROUND_ROBIN,
      bestOf: 3,
      settings,
    });

    expect(round.create).toHaveBeenCalledWith({
      data: {
        name: 'League stage',
        format: RoundFormat.ROUND_ROBIN,
        bestOf: 3,
        settings,
        orderIndex: 3,
        tournamentId: 'tournament-1',
      },
    });
    expect(result).toEqual(expect.objectContaining({ settings }));
  });

  it('normalizes and persists canonical Group Stage settings through add-round', async () => {
    const round = {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'group-round', ...data }),
        ),
    };
    const service = new TournamentsService(
      { round } as unknown as PrismaService,
      new RoundSettingsService(),
      {} as StandingsService,
      {} as ContentFilterService,
    );

    const result = await service.addRound('tournament-1', {
      name: 'Group stage',
      format: RoundFormat.GROUP_STAGE,
      bestOf: 3,
      settings: {
        numberOfGroups: 4,
        advancingTeamsPerGroup: 2,
        meetingsPerPair: 2,
        allowDraws: true,
      },
    });

    const settings = {
      numberOfGroups: 4,
      advancingTeamsPerGroup: 2,
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      allowDraws: true,
      meetingsPerPair: 2,
    };
    expect(round.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        format: RoundFormat.GROUP_STAGE,
        bestOf: 3,
        settings,
      }),
    });
    expect(result).toEqual(expect.objectContaining({ settings }));
  });

  it.each([
    [RoundFormat.PLAYOFF, { thirdPlaceMatch: false }],
    [RoundFormat.DOUBLE_ELIM, { grandFinalReset: false }],
  ] as const)(
    'persists canonical %s settings through add-round without fixed seeding JSON',
    async (format, settings) => {
      const round = {
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ id: 'elimination-round', ...data }),
          ),
      };
      const service = new TournamentsService(
        { round } as unknown as PrismaService,
        new RoundSettingsService(),
        {} as StandingsService,
        {} as ContentFilterService,
      );

      const result = await service.addRound('tournament-1', {
        name: 'Final stage',
        format,
        bestOf: 5,
        settings: { seeding: 'STANDARD', ...settings },
      });

      expect(round.create).toHaveBeenCalledWith({
        data: expect.objectContaining({ format, bestOf: 5, settings }),
      });
      expect(result).toEqual(expect.objectContaining({ settings }));
    },
  );

  it('normalizes and persists canonical Swiss settings during tournament creation', async () => {
    const tx = {
      tournament: {
        create: jest.fn().mockResolvedValue({ id: 'tournament-1' }),
        findUnique: jest.fn().mockResolvedValue({
          id: 'tournament-1',
          rounds: [],
        }),
      },
      round: { create: jest.fn().mockResolvedValue({ id: 'swiss-round' }) },
    };
    const prisma = {
      game: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'game-1',
          name: 'Test Game',
          defaultTeamSize: 5,
          maxTeamSize: 7,
        }),
      },
      tournament: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new TournamentsService(
      prisma,
      new RoundSettingsService(),
      {} as StandingsService,
      { validate: jest.fn() } as unknown as ContentFilterService,
    );

    await service.create('organizer-1', {
      name: 'Swiss Cup',
      gameId: 'game-1',
      maxTeamSize: 7,
      rounds: [
        {
          name: 'Swiss stage',
          format: RoundFormat.SWISS,
          bestOf: 3,
          settings: { numberOfRounds: null, advancingTeamCount: 4 },
        },
      ],
    });

    expect(tx.round.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        format: RoundFormat.SWISS,
        bestOf: 3,
        settings: { numberOfRounds: null, advancingTeamCount: 4 },
      }),
    });
  });

  it('normalizes legacy Swiss settings through the add-round flow', async () => {
    const round = {
      findFirst: jest.fn().mockResolvedValue({ orderIndex: 1 }),
      create: jest
        .fn()
        .mockImplementation(({ data }) =>
          Promise.resolve({ id: 'swiss-round', ...data }),
        ),
    };
    const service = new TournamentsService(
      { round } as unknown as PrismaService,
      new RoundSettingsService(),
      {} as StandingsService,
      {} as ContentFilterService,
    );

    const result = await service.addRound('tournament-1', {
      name: 'Swiss stage',
      format: RoundFormat.SWISS,
      settings: { numRounds: 5, advanceCount: 4 },
    });

    const settings = { numberOfRounds: 5, advancingTeamCount: 4 };
    expect(round.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        format: RoundFormat.SWISS,
        settings,
      }),
    });
    expect(result).toEqual(expect.objectContaining({ settings }));
  });
});

describe('TournamentsService standings read model', () => {
  it('exposes persisted qualification and next-stage assignments without deriving them', async () => {
    const qualifiedTeam = {
      id: 'team-1',
      name: 'Team One',
      shortName: 'ONE',
      logoUrl: null,
      seed: 1,
    };
    const tournament = {
      id: 'tournament-1',
      name: 'Integration Cup',
      status: TournamentStatus.ONGOING,
      organizerId: 'organizer-1',
      visibility: 'PUBLIC',
      moderationStatus: 'ACTIVE',
      teams: [],
      rounds: [
        {
          id: 'groups',
          name: 'Group Stage',
          orderIndex: 0,
          format: RoundFormat.GROUP_STAGE,
          status: RoundStatus.COMPLETED,
          settings: {},
          matches: [
            { status: MatchStatus.COMPLETED, isActive: true },
            { status: MatchStatus.COMPLETED, isActive: true },
          ],
          participants: [],
          advancedTeams: [
            {
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              team: qualifiedTeam,
              round: {
                id: 'playoff',
                name: 'Playoff',
                orderIndex: 1,
                format: RoundFormat.PLAYOFF,
                status: RoundStatus.UPCOMING,
              },
            },
          ],
        },
        {
          id: 'playoff',
          name: 'Playoff',
          orderIndex: 1,
          format: RoundFormat.PLAYOFF,
          status: RoundStatus.UPCOMING,
          settings: {},
          matches: [],
          participants: [
            {
              createdAt: new Date('2026-01-01T00:00:00.000Z'),
              team: qualifiedTeam,
              advancedFromRound: {
                id: 'groups',
                name: 'Group Stage',
                orderIndex: 0,
                format: RoundFormat.GROUP_STAGE,
              },
            },
          ],
          advancedTeams: [],
        },
      ],
    };
    const prisma = {
      tournament: { findUnique: jest.fn().mockResolvedValue(tournament) },
    } as unknown as PrismaService;
    const standingsService = {
      forTournament: jest.fn().mockResolvedValue({
        tournamentId: tournament.id,
        rounds: [
          { roundId: 'groups', standings: [] },
          { roundId: 'playoff', standings: [] },
        ],
      }),
    } as unknown as StandingsService;
    const service = new TournamentsService(
      prisma,
      {} as RoundSettingsService,
      standingsService,
      {} as ContentFilterService,
    );

    const result = await service.getStandings('integration-cup');

    expect(result.rounds[0]).toEqual(
      expect.objectContaining({
        progress: expect.objectContaining({
          completedMatches: 2,
          allRequiredMatchesCompleted: true,
        }),
        advancement: expect.objectContaining({
          state: 'READY_FOR_GENERATION',
          nextRound: expect.objectContaining({ participantCount: 1 }),
          qualifiedTeams: [expect.objectContaining({ team: qualifiedTeam })],
        }),
      }),
    );
    expect(result.rounds[1].participants).toHaveLength(1);
  });
});

describe('TournamentsService roster snapshots', () => {
  function creationHarness(defaultTeamSize: number, maxTeamSize: number) {
    const game = {
      id: 'game-1',
      name: 'Test Game',
      defaultTeamSize,
      minTeamSize: defaultTeamSize,
      maxTeamSize,
    };
    const tx = {
      tournament: {
        create: jest.fn().mockResolvedValue({ id: 'tournament-1' }),
        findUnique: jest.fn().mockResolvedValue({ id: 'tournament-1' }),
      },
    };
    const prisma = {
      game: { findFirst: jest.fn().mockResolvedValue(game) },
      tournament: { findUnique: jest.fn().mockResolvedValue(null) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const contentFilter = {
      validate: jest.fn(),
    } as unknown as ContentFilterService;
    return {
      service: new TournamentsService(
        prisma,
        {} as RoundSettingsService,
        {} as StandingsService,
        contentFilter,
      ),
      tx,
    };
  }

  it.each([
    ['Liên Quân', 5, 7, 5],
    ['Liên Quân', 5, 7, 6],
    ['Liên Quân', 5, 7, 7],
    ['Rocket League', 3, 4, 3],
    ['Rocket League', 3, 4, 4],
    ['Tekken', 1, 1, 1],
  ])(
    'snapshots the active roster for %s with maximum %i',
    async (_, min, gameMax, requestedMax) => {
      const { service, tx } = creationHarness(min as number, gameMax as number);

      await service.create('organizer-1', {
        name: 'Roster Cup',
        gameId: 'game-1',
        maxTeamSize: requestedMax as number,
      });

      expect(tx.tournament.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            minTeamSize: min,
            maxTeamSize: requestedMax,
          }),
        }),
      );
      expect(tx.tournament.create.mock.calls[0][0].data).not.toHaveProperty(
        'maxSubstitutes',
      );
    },
  );

  it.each([
    [5, 7, 4],
    [5, 7, 8],
    [3, 4, 5],
  ])(
    'rejects maximum %i outside the game range %i-%i',
    async (min, gameMax, requestedMax) => {
      const { service, tx } = creationHarness(min, gameMax);

      await expect(
        service.create('organizer-1', {
          name: 'Invalid Cup',
          gameId: 'game-1',
          maxTeamSize: requestedMax,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(tx.tournament.create).not.toHaveBeenCalled();
    },
  );

  it('does not trust a client-provided minimum roster', async () => {
    const { service, tx } = creationHarness(5, 7);
    const tamperedDto = {
      name: 'Tampered Cup',
      gameId: 'game-1',
      minTeamSize: 3,
      maxTeamSize: 5,
    } as unknown as CreateTournamentDto;

    await service.create('organizer-1', tamperedDto);

    expect(tx.tournament.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ minTeamSize: 5, maxTeamSize: 5 }),
      }),
    );
  });

  it('re-snapshots and resets the maximum when the game changes', async () => {
    const current = {
      id: 'tournament-1',
      gameId: 'old-game',
      minTeamSize: 5,
      maxTeamSize: 7,
      mode: TournamentMode.ONLINE,
      location: null,
      minAge: null,
      maxAge: null,
      registrationStartDate: null,
      registrationDeadline: null,
      startDate: null,
      endDate: null,
      game: { id: 'old-game', defaultTeamSize: 5, maxTeamSize: 7 },
    };
    const prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue(current),
        update: jest.fn().mockResolvedValue({
          id: 'tournament-1',
          rounds: [
            {
              id: 'group-round',
              format: RoundFormat.GROUP_STAGE,
              settings: {
                numGroups: 2,
                advanceCount: 1,
                doubleRound: true,
                pointsWin: 2,
                pointsDraw: 1,
                pointsLoss: 0,
              },
            },
          ],
        }),
      },
      game: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'rocket-league',
          defaultTeamSize: 3,
          maxTeamSize: 4,
        }),
      },
    } as unknown as PrismaService;
    const service = new TournamentsService(
      prisma,
      new RoundSettingsService(),
      {} as StandingsService,
      {} as ContentFilterService,
    );

    const result = await service.update('tournament-1', {
      gameId: 'rocket-league',
    });

    expect(prisma.tournament.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          gameId: 'rocket-league',
          minTeamSize: 3,
          maxTeamSize: 4,
        }),
      }),
    );
    expect(result.rounds[0].settings).toEqual({
      numberOfGroups: 2,
      advancingTeamsPerGroup: 1,
      winPoints: 2,
      drawPoints: 1,
      lossPoints: 0,
      allowDraws: true,
      meetingsPerPair: 2,
    });
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
