/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  NotificationType,
  ReportReason,
  ReportStatus,
  Role,
} from '@prisma/client';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { ReportService } from './report.service';

function harness(pendingCount = 1) {
  const tx = {
    tournament: {
      findUnique: jest.fn().mockResolvedValue({ id: 't-1', name: 'Cup' }),
    },
    report: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({
        id: 'r-1',
        tournamentId: 't-1',
        reason: ReportReason.SCAM,
        description: 'Suspicious tournament',
        status: ReportStatus.PENDING,
        createdAt: new Date('2026-08-12T00:00:00Z'),
      }),
      count: jest.fn().mockResolvedValue(pendingCount),
    },
    user: { findMany: jest.fn().mockResolvedValue([]) },
    notification: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  const config = {
    get: jest.fn().mockReturnValue(3),
  } as unknown as ConfigService;
  const notifications = {
    createNotification: jest.fn(),
    emitCreated: jest.fn(),
  } as unknown as NotificationService;
  return {
    service: new ReportService(prisma, config, notifications),
    tx,
    notifications,
  };
}

describe('ReportService', () => {
  it('creates an anonymous report with no reporter identity', async () => {
    const { service, tx } = harness();

    const result = await service.create('cup', {
      reason: ReportReason.SCAM,
      description: ' Suspicious tournament ',
    });

    expect(tx.report.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          tournamentId: 't-1',
          reporterUserId: null,
          reason: ReportReason.SCAM,
          description: 'Suspicious tournament',
        },
      }),
    );
    expect(result).not.toHaveProperty('reporterUserId');
  });

  it('stores the authenticated reporter identity', async () => {
    const { service, tx } = harness();
    await service.create('cup', { reason: ReportReason.GAMBLING }, 'user-1');
    expect(tx.report.findFirst).toHaveBeenCalledWith({
      where: {
        tournamentId: 't-1',
        reporterUserId: 'user-1',
        status: ReportStatus.PENDING,
      },
      select: { id: true },
    });
  });

  it('rejects a duplicate active authenticated report', async () => {
    const { service, tx } = harness();
    tx.report.findFirst.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create('cup', { reason: ReportReason.SCAM }, 'user-1'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(tx.report.create).not.toHaveBeenCalled();
  });

  it('notifies every unlocked admin when threshold is reached', async () => {
    const { service, tx, notifications } = harness(3);
    tx.user.findMany.mockResolvedValue([{ id: 'admin-1' }, { id: 'admin-2' }]);
    jest
      .mocked(notifications.createNotification)
      .mockImplementation(({ userId, type, content, tournamentId }) =>
        Promise.resolve({
          id: `n-${userId}`,
          userId,
          type,
          content,
          tournamentId: tournamentId ?? null,
          isRead: false,
          createdAt: new Date(),
        }),
      );

    await service.create('cup', { reason: ReportReason.SCAM });

    expect(tx.user.findMany).toHaveBeenCalledWith({
      where: { role: Role.ADMIN, isLocked: false },
      select: { id: true },
    });
    expect(notifications.createNotification).toHaveBeenCalledTimes(2);
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'admin-1',
        type: NotificationType.SYSTEM,
        tournamentId: 't-1',
      }),
      tx,
      false,
    );
    expect(notifications.emitCreated).toHaveBeenCalledTimes(2);
  });

  it('does not repeat threshold notifications above the threshold', async () => {
    const { service, tx, notifications } = harness(4);
    await service.create('cup', { reason: ReportReason.SCAM });
    expect(tx.user.findMany).not.toHaveBeenCalled();
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });

  it('does not repeat an existing threshold notification', async () => {
    const { service, tx, notifications } = harness(3);
    tx.notification.findFirst.mockResolvedValue({ id: 'existing' });

    await service.create('cup', { reason: ReportReason.SCAM });

    expect(tx.user.findMany).not.toHaveBeenCalled();
    expect(notifications.createNotification).not.toHaveBeenCalled();
  });
});
