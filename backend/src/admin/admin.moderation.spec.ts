import { BadRequestException } from '@nestjs/common';
import {
  ModerationStatus,
  NotificationType,
  ReportStatus,
  Role,
  TournamentStatus,
} from '@prisma/client';
import { ContentFilterService } from '../common/services/content-filter.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';
import {
  AdminDashboardQueryService,
  BannedKeywordService,
} from './admin-operations.services';
import { CommentModerationService } from '../comments/comment-moderation.service';
import { ReportReviewService } from '../reports/report-review.service';
import { TournamentModerationService } from '../tournaments/tournament-moderation.service';
import { UserAdministrationService } from '../users/user-administration.service';
import { NotificationPublisher } from '../common/ports/notification-publisher';

function setup() {
  const prisma = {
    tournament: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    report: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
      count: jest.fn(),
    },
    comment: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    match: {
      count: jest.fn(),
    },
    game: {
      findMany: jest.fn(),
    },
  };
  const notifications = { createNotification: jest.fn() };
  return {
    service: new AdminService(
      new AdminDashboardQueryService(prisma as unknown as PrismaService),
      new UserAdministrationService(prisma as unknown as PrismaService),
      new TournamentModerationService(
        prisma as unknown as PrismaService,
        notifications as unknown as NotificationPublisher,
      ),
      new ReportReviewService(prisma as unknown as PrismaService),
      new CommentModerationService(prisma as unknown as PrismaService),
      new BannedKeywordService(
        prisma as unknown as PrismaService,
        {} as ContentFilterService,
      ),
    ),
    prisma,
    notifications,
  };
}

describe('AdminService moderation', () => {
  afterEach(() => jest.useRealTimers());

  it('exposes the custom display name and stable game code in moderation lists', async () => {
    const { service, prisma } = setup();
    prisma.tournament.findMany.mockResolvedValue([
      {
        id: 'custom-tournament',
        customGameName: 'Chess',
        game: { id: 'custom-game', code: 'CUSTOM', name: 'Custom Game' },
      },
    ]);

    await expect(service.listTournaments()).resolves.toEqual([
      expect.objectContaining({
        displayGameName: 'Chess',
        game: expect.objectContaining({ code: 'CUSTOM' }),
      }),
    ]);
    expect(prisma.tournament.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          game: { select: { id: true, code: true, name: true } },
        }),
      }),
    );
  });

  it('applies tournament discovery filters to the moderation list', async () => {
    const { service, prisma } = setup();
    prisma.tournament.findMany.mockResolvedValue([]);

    await service.listTournaments({
      search: 'valorant',
      gameId: 'game-1',
      status: TournamentStatus.ONGOING,
      moderationStatus: ModerationStatus.ACTIVE,
    });

    expect(prisma.tournament.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          gameId: 'game-1',
          status: TournamentStatus.ONGOING,
          moderationStatus: ModerationStatus.ACTIVE,
          OR: [
            { name: { contains: 'valorant', mode: 'insensitive' } },
            {
              game: {
                name: { contains: 'valorant', mode: 'insensitive' },
              },
            },
            {
              customGameName: {
                contains: 'valorant',
                mode: 'insensitive',
              },
            },
          ],
        },
      }),
    );
  });

  it('requires a reason and warns the organizer when hiding', async () => {
    const { service, prisma, notifications } = setup();
    await expect(
      service.moderateTournament(
        't-1',
        ModerationStatus.HIDDEN_BY_ADMIN,
        'admin@example.com',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.tournament.findUnique.mockResolvedValue({
      id: 't-1',
      name: 'Cup',
      organizerId: 'u-1',
      moderationStatus: ModerationStatus.ACTIVE,
    });
    prisma.tournament.update.mockResolvedValue({ id: 't-1' });
    await service.moderateTournament(
      't-1',
      ModerationStatus.HIDDEN_BY_ADMIN,
      'admin@example.com',
      'Policy violation',
    );
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        type: NotificationType.ADMIN_WARNING,
        tournamentId: 't-1',
        data: expect.objectContaining({ adminEmail: 'admin@example.com' }),
      }),
    );
  });

  it('notifies the organizer when a hidden tournament is restored', async () => {
    const { service, prisma, notifications } = setup();
    prisma.tournament.findUnique.mockResolvedValue({
      id: 't-1',
      organizerId: 'u-1',
      moderationStatus: ModerationStatus.HIDDEN_BY_ADMIN,
    });
    prisma.tournament.update.mockResolvedValue({
      id: 't-1',
      moderationStatus: ModerationStatus.ACTIVE,
      updatedAt: new Date('2026-08-29T00:00:00.000Z'),
    });

    await service.moderateTournament(
      't-1',
      ModerationStatus.ACTIVE,
      'restoring-admin@example.com',
    );

    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        type: NotificationType.ADMIN_WARNING,
        data: expect.objectContaining({
          kind: 'TOURNAMENT_MODERATION',
          moderationStatus: ModerationStatus.ACTIVE,
          adminEmail: 'restoring-admin@example.com',
        }),
      }),
    );
  });

  it('only permits PENDING reports to become REVIEWED or DISMISSED', async () => {
    const { service, prisma } = setup();
    prisma.report.findUnique.mockResolvedValue({
      id: 'r-1',
      status: ReportStatus.PENDING,
    });
    prisma.report.update.mockResolvedValue({ status: ReportStatus.REVIEWED });
    await service.reviewReport('r-1', ReportStatus.REVIEWED, 'admin-1');
    expect(prisma.report.update).toHaveBeenCalledWith({
      where: { id: 'r-1' },
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      data: expect.objectContaining({
        status: ReportStatus.REVIEWED,
        reviewedBy: 'admin-1',
      }),
    });

    prisma.report.findUnique.mockResolvedValue({
      id: 'r-1',
      status: ReportStatus.REVIEWED,
    });
    await expect(
      service.reviewReport('r-1', ReportStatus.DISMISSED, 'admin-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('locks and unlocks users and invalidates tokens when locking', async () => {
    const { service, prisma } = setup();
    prisma.user.findUnique.mockResolvedValue({ id: 'u-1' });
    prisma.user.update.mockResolvedValue({ id: 'u-1', isLocked: true });
    await service.setUserLockStatus('admin-1', 'u-1', true);
    expect(prisma.user.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { isLocked: true, tokenVersion: { increment: 1 } },
      }),
    );
    await service.setUserLockStatus('admin-1', 'u-1', false);
    expect(prisma.user.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { isLocked: false } }),
    );
  });

  it('owns and rejects the self-lock rule before persistence access', async () => {
    const { service, prisma } = setup();
    await expect(
      service.setUserLockStatus('admin-1', 'admin-1', true),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('calculates moderation statistics', async () => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-07T03:00:00.000Z'));
    const { service, prisma } = setup();
    prisma.tournament.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(4);
    prisma.user.count.mockResolvedValueOnce(20).mockResolvedValueOnce(3);
    prisma.match.count.mockResolvedValueOnce(100).mockResolvedValueOnce(6);
    prisma.report.count.mockResolvedValue(5);
    prisma.report.groupBy.mockResolvedValue([
      { tournamentId: 't-1' },
      { tournamentId: 't-2' },
    ]);
    prisma.user.findMany.mockResolvedValue([
      { createdAt: new Date('2026-09-01T00:00:00.000Z') },
      { createdAt: new Date('2026-09-07T00:00:00.000Z') },
      { createdAt: new Date('2026-08-30T00:00:00.000Z') },
    ]);
    prisma.tournament.findMany
      .mockResolvedValueOnce([
        { createdAt: new Date('2026-09-02T00:00:00.000Z') },
        { createdAt: new Date('2026-08-28T00:00:00.000Z') },
      ])
      .mockResolvedValueOnce([]);
    prisma.tournament.groupBy
      .mockResolvedValueOnce([
        { status: TournamentStatus.ONGOING, _count: { _all: 2 } },
      ])
      .mockResolvedValueOnce([
        {
          gameId: 'game-1',
          customGameName: null,
          _count: { _all: 4 },
        },
        {
          gameId: 'custom-game',
          customGameName: 'Chess',
          _count: { _all: 2 },
        },
        {
          gameId: 'custom-game',
          customGameName: 'chess',
          _count: { _all: 1 },
        },
      ]);
    prisma.game.findMany.mockResolvedValue([
      { id: 'game-1', code: 'VALORANT', name: 'Valorant' },
      { id: 'custom-game', code: 'CUSTOM', name: 'Custom Game' },
    ]);
    prisma.report.findMany.mockResolvedValue([]);

    const result = await service.stats();
    expect(result).toEqual(
      expect.objectContaining({
        periodDays: 7,
        totalTournaments: 10,
        totalUsers: 20,
        newUsers: 2,
        userGrowthPercent: 100,
        ongoingTournaments: 2,
        officialTournaments: 1,
        totalMatches: 100,
        matchesToday: 6,
        pendingReports: 5,
        tournamentsWithPendingReports: 2,
        tournamentsBeingReported: 2,
        hiddenTournaments: 4,
        lockedTournaments: 4,
        lockedAccounts: 3,
        newTournaments: 1,
        tournamentGrowthPercent: 0,
        tournamentsCreatedLast7Days: 1,
        tournamentStatusDistribution: expect.arrayContaining([
          { status: TournamentStatus.ONGOING, count: 2 },
        ]),
        topGames: [
          {
            gameId: 'game-1',
            displayGameName: 'Valorant',
            tournamentCount: 4,
          },
          {
            gameId: 'custom:chess',
            displayGameName: 'Chess',
            tournamentCount: 3,
          },
        ],
        recentReports: [],
        recentTournaments: [],
      }),
    );
    expect(result.dailyGrowth).toHaveLength(7);
    expect(result.dailyGrowth[0]).toEqual({
      date: '2026-09-01',
      newUsers: 1,
      newTournaments: 0,
    });
    expect(result.dailyGrowth[6]).toEqual({
      date: '2026-09-07',
      newUsers: 1,
      newTournaments: 0,
    });
    expect(prisma.match.count).toHaveBeenLastCalledWith({
      where: {
        isActive: true,
        isBye: false,
        scheduledAt: {
          gte: new Date('2026-09-06T17:00:00.000Z'),
          lt: new Date('2026-09-07T17:00:00.000Z'),
        },
      },
    });
  });

  it('toggles or explicitly sets verified state', async () => {
    const { service, prisma } = setup();
    prisma.tournament.findUnique.mockResolvedValue({
      id: 't-1',
      isVerified: false,
      moderationStatus: ModerationStatus.ACTIVE,
    });
    prisma.tournament.update.mockResolvedValue({ id: 't-1', isVerified: true });
    await service.verifyTournament('t-1');
    expect(prisma.tournament.update).toHaveBeenLastCalledWith({
      where: { id: 't-1' },
      data: { isVerified: true },
    });
    await service.verifyTournament('t-1', false);
    expect(prisma.tournament.update).toHaveBeenLastCalledWith({
      where: { id: 't-1' },
      data: { isVerified: false },
    });
  });

  it('keeps official and verified labels consistent', async () => {
    const { service, prisma } = setup();
    prisma.tournament.findUnique.mockResolvedValue({
      id: 't-1',
      isOfficial: false,
      moderationStatus: ModerationStatus.ACTIVE,
      organizer: { role: Role.ADMIN },
    });
    prisma.tournament.update.mockResolvedValue({
      id: 't-1',
      isOfficial: true,
      isVerified: true,
    });

    await service.setTournamentOfficial('t-1', true);
    expect(prisma.tournament.update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { isOfficial: true, isVerified: true },
    });

    prisma.tournament.findUnique.mockResolvedValue({
      id: 't-1',
      isOfficial: true,
      isVerified: true,
      moderationStatus: ModerationStatus.ACTIVE,
    });
    await expect(service.verifyTournament('t-1', false)).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('does not mark a community-organized tournament as official', async () => {
    const { service, prisma } = setup();
    prisma.tournament.findUnique.mockResolvedValue({
      id: 't-1',
      isOfficial: false,
      moderationStatus: ModerationStatus.ACTIVE,
      organizer: { role: Role.SIGNED_UP_USER },
    });

    await expect(
      service.setTournamentOfficial('t-1', true),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.tournament.update).not.toHaveBeenCalled();
  });
});
