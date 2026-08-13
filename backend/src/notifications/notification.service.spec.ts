/* eslint-disable @typescript-eslint/unbound-method */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { NotificationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationScope } from './dto/notification.dto';
import { NotificationEventsService } from './notification-events.service';
import { NotificationService } from './notification.service';

function harness() {
  let sequence = 0;
  const notification = {
    create: jest.fn(({ data }: { data: Record<string, unknown> }) =>
      Promise.resolve({
        id: `n-${++sequence}`,
        isRead: false,
        createdAt: new Date('2026-08-12T00:00:00Z'),
        ...data,
      }),
    ),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findFirst: jest.fn(),
    update: jest.fn(),
    updateMany: jest.fn(),
  };
  const prisma = {
    notification,
    tournament: {
      findUnique: jest.fn().mockResolvedValue({ id: 't-1' }),
    },
    team: { findMany: jest.fn() },
    $transaction: jest.fn(
      (callback: (tx: { notification: typeof notification }) => unknown) =>
        callback({ notification }),
    ),
  } as unknown as PrismaService;
  const events = new NotificationEventsService();
  return {
    service: new NotificationService(prisma, events),
    prisma,
    notification,
    events,
  };
}

describe('NotificationService', () => {
  it('creates a notification through the reusable persistence method', async () => {
    const { service, notification } = harness();

    await service.createNotification({
      userId: 'user-1',
      type: NotificationType.SYSTEM,
      content: 'Hello',
      tournamentId: 't-1',
    });

    expect(notification.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        type: NotificationType.SYSTEM,
        content: 'Hello',
        tournamentId: 't-1',
      },
    });
  });

  it('notifies all distinct captains and registered members for tournament scope', async () => {
    const { service, prisma } = harness();
    jest.mocked(prisma.team.findMany).mockResolvedValue([
      {
        id: 'team-1',
        captainId: 'captain',
        members: [{ userId: 'captain' }, { userId: 'member' }],
      },
      {
        id: 'team-2',
        captainId: 'captain-2',
        members: [{ userId: 'member' }],
      },
    ] as never);

    const result = await service.createForTournament('cup', {
      type: NotificationType.SYSTEM,
      content: 'Tournament message',
      scope: NotificationScope.WHOLE_TOURNAMENT,
    });

    expect(result.recipientCount).toBe(3);
    expect(result.notifications.map((item) => item.userId).sort()).toEqual([
      'captain',
      'captain-2',
      'member',
    ]);
  });

  it('limits team scope to the requested team', async () => {
    const { service, prisma } = harness();
    jest.mocked(prisma.team.findMany).mockResolvedValue([
      {
        id: 'team-1',
        captainId: 'captain',
        members: [{ userId: 'member' }],
      },
    ] as never);

    await expect(
      service.createForTournament('cup', {
        type: NotificationType.SCHEDULE_CHANGE,
        content: 'New time',
        scope: NotificationScope.TEAM,
        teamId: 'team-1',
      }),
    ).resolves.toEqual(expect.objectContaining({ recipientCount: 2 }));
    expect(prisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tournamentId: 't-1', id: 'team-1' },
      }),
    );
  });

  it('rejects a team outside the tournament', async () => {
    const { service, prisma } = harness();
    jest.mocked(prisma.team.findMany).mockResolvedValue([]);
    await expect(
      service.createForTournament('cup', {
        type: NotificationType.SYSTEM,
        content: 'Message',
        scope: NotificationScope.TEAM,
        teamId: 'other-team',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('paginates and filters notifications by read state and current user', async () => {
    const { service, notification } = harness();
    notification.count.mockResolvedValue(41);

    await expect(
      service.findForUser('user-1', { page: 2, limit: 20, isRead: 'false' }),
    ).resolves.toEqual({
      data: [],
      pagination: { page: 2, limit: 20, total: 41, totalPages: 3 },
    });
    expect(notification.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1', isRead: false },
        skip: 20,
        take: 20,
      }),
    );
  });

  it('marks only an owned notification as read', async () => {
    const { service, notification } = harness();
    notification.findFirst.mockResolvedValue({ id: 'n-1' });
    notification.update.mockResolvedValue({ id: 'n-1', isRead: true });

    await service.markRead('user-1', 'n-1');

    expect(notification.findFirst).toHaveBeenCalledWith({
      where: { id: 'n-1', userId: 'user-1' },
      select: { id: true },
    });
  });

  it('rejects access to another user notification', async () => {
    const { service, notification } = harness();
    notification.findFirst.mockResolvedValue(null);
    await expect(service.markRead('user-1', 'other')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(notification.update).not.toHaveBeenCalled();
  });

  it('marks all unread notifications for the current user', async () => {
    const { service, notification } = harness();
    notification.updateMany.mockResolvedValue({ count: 4 });
    await expect(service.markAllRead('user-1')).resolves.toEqual({
      updatedCount: 4,
    });
    expect(notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', isRead: false },
      data: { isRead: true },
    });
  });

  it('returns the unread count for the current user', async () => {
    const { service, notification } = harness();
    notification.count.mockResolvedValue(7);
    await expect(service.unreadCount('user-1')).resolves.toEqual({ count: 7 });
    expect(notification.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', isRead: false },
    });
  });
});
