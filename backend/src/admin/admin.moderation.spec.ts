import { BadRequestException } from '@nestjs/common';
import {
  ModerationStatus,
  NotificationType,
  ReportStatus,
} from '@prisma/client';
import { ContentFilterService } from '../common/services/content-filter.service';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

function setup() {
  const prisma = {
    tournament: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    report: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      groupBy: jest.fn(),
    },
    comment: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    user: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };
  const notifications = { createNotification: jest.fn() };
  return {
    service: new AdminService(
      prisma as unknown as PrismaService,
      {} as ContentFilterService,
      notifications as unknown as NotificationService,
    ),
    prisma,
    notifications,
  };
}

describe('AdminService moderation', () => {
  it('requires a reason and warns the organizer when hiding', async () => {
    const { service, prisma, notifications } = setup();
    await expect(
      service.moderateTournament('t-1', ModerationStatus.HIDDEN_BY_ADMIN),
    ).rejects.toBeInstanceOf(BadRequestException);

    prisma.tournament.findUnique.mockResolvedValue({
      id: 't-1',
      name: 'Cup',
      organizerId: 'u-1',
    });
    prisma.tournament.update.mockResolvedValue({ id: 't-1' });
    await service.moderateTournament(
      't-1',
      ModerationStatus.HIDDEN_BY_ADMIN,
      'Policy violation',
    );
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-1',
        type: NotificationType.ADMIN_WARNING,
        tournamentId: 't-1',
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
    await service.setUserLockStatus('u-1', true);
    expect(prisma.user.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: { isLocked: true, tokenVersion: { increment: 1 } },
      }),
    );
    await service.setUserLockStatus('u-1', false);
    expect(prisma.user.update).toHaveBeenLastCalledWith(
      expect.objectContaining({ data: { isLocked: false } }),
    );
  });

  it('calculates moderation statistics', async () => {
    const { service, prisma } = setup();
    prisma.tournament.count
      .mockResolvedValueOnce(10)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(4);
    prisma.user.count.mockResolvedValueOnce(20).mockResolvedValueOnce(3);
    prisma.report.groupBy.mockResolvedValue([
      { tournamentId: 't-1' },
      { tournamentId: 't-2' },
    ]);
    await expect(service.stats()).resolves.toEqual({
      totalTournaments: 10,
      totalUsers: 20,
      tournamentsBeingReported: 2,
      lockedTournaments: 2,
      lockedAccounts: 3,
      tournamentsCreatedLast7Days: 4,
    });
  });

  it('toggles or explicitly sets verified state', async () => {
    const { service, prisma } = setup();
    prisma.tournament.findUnique.mockResolvedValue({
      id: 't-1',
      isVerified: false,
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
});
