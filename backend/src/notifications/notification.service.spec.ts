/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, NotFoundException } from '@nestjs/common';
import {
  ModerationStatus,
  NotificationType,
  RegistrationStatus,
  Role,
  Visibility,
} from '@prisma/client';
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
    createManyAndReturn: jest
      .fn()
      .mockImplementation(
        ({ data }: { data: Array<Record<string, unknown>> }) =>
          Promise.resolve(
            data.map((item) => ({
              id: `n-${++sequence}`,
              isRead: false,
              createdAt: new Date('2026-08-12T00:00:00Z'),
              ...item,
            })),
          ),
      ),
  };
  const prisma = {
    notification,
    user: {
      findMany: jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(
          where.id.in.map((id) => ({ id, role: Role.SIGNED_UP_USER })),
        ),
      ),
    },
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
    expect(prisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          tournamentId: 't-1',
          status: RegistrationStatus.APPROVED,
        }) as object,
      }),
    );
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

  it('sends tournament-wide events only to distinct approved participants', async () => {
    const { service, prisma, notification, events } = harness();
    jest.mocked(prisma.tournament.findUnique).mockResolvedValue({
      organizerId: 'organizer',
      visibility: Visibility.PUBLIC,
      moderationStatus: ModerationStatus.ACTIVE,
      favorites: [],
      teams: [
        {
          status: RegistrationStatus.APPROVED,
          captainId: 'captain',
          members: [
            { userId: 'captain' },
            { userId: 'member' },
            { userId: null },
          ],
        },
        {
          status: RegistrationStatus.APPROVED,
          captainId: 'captain-2',
          members: [{ userId: 'member' }],
        },
      ],
    } as never);
    const emitted: string[] = [];
    const subscription = events.events$.subscribe((item) =>
      emitted.push(item.userId),
    );

    const result = await service.createForTournamentEvent({
      tournamentId: 't-1',
      type: NotificationType.SCHEDULE_CHANGE,
      content: 'Schedule changed',
      sourceKey: 'match:m-1:schedule:revision-1',
    });

    expect(result).toEqual(
      expect.objectContaining({ recipientCount: 3, createdCount: 3 }),
    );
    expect(notification.createManyAndReturn).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ userId: 'captain' }),
        expect.objectContaining({ userId: 'captain-2' }),
        expect.objectContaining({ userId: 'member' }),
      ]),
      skipDuplicates: true,
    });
    expect(prisma.tournament.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        select: expect.objectContaining({
          teams: expect.any(Object) as object,
          favorites: expect.any(Object) as object,
        }) as object,
      }),
    );
    expect(emitted.sort()).toEqual(['captain', 'captain-2', 'member']);
    subscription.unsubscribe();
  });

  it('sends a match event to teams A and B but not team C or the organizer', async () => {
    const { service, prisma, notification } = harness();
    jest.mocked(prisma.team.findMany).mockResolvedValue([
      {
        captainId: 'captain-a',
        members: [{ userId: 'shared-user' }, { userId: null }],
      },
      {
        captainId: 'captain-b',
        members: [{ userId: 'shared-user' }, { userId: 'member-b' }],
      },
    ] as never);

    const result = await service.createForMatchEvent({
      tournamentId: 't-1',
      teamIds: ['team-a', 'team-b'],
      type: NotificationType.SCORE_UPDATE,
      content: 'Match result updated',
      data: { kind: 'MATCH_RESULT', matchId: 'match-1' },
      sourceKey: 'match:match-1:result:revision-1',
    });

    expect(prisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tournamentId: 't-1',
          id: { in: ['team-a', 'team-b'] },
        },
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ recipientCount: 4, createdCount: 4 }),
    );
    expect(
      notification.createManyAndReturn.mock.calls[0][0].data.map(
        (item: { userId: string }) => item.userId,
      ),
    ).toEqual(
      expect.arrayContaining([
        'captain-a',
        'captain-b',
        'shared-user',
        'member-b',
      ]),
    );
    expect(notification.createManyAndReturn.mock.calls[0][0].data).not.toEqual(
      expect.arrayContaining([
        expect.objectContaining({ userId: 'captain-c' }),
        expect.objectContaining({ userId: 'organizer' }),
      ]),
    );
    expect(
      notification.createManyAndReturn.mock.calls[0][0].data[0],
    ).not.toHaveProperty('teamIds');
  });

  it('emits only newly inserted records when an event is retried', async () => {
    const { service, prisma, notification, events } = harness();
    jest.mocked(prisma.tournament.findUnique).mockResolvedValue({
      organizerId: 'organizer',
      visibility: Visibility.PUBLIC,
      moderationStatus: ModerationStatus.ACTIVE,
      favorites: [],
      teams: [
        {
          status: RegistrationStatus.APPROVED,
          captainId: 'participant',
          members: [],
        },
      ],
    } as never);
    notification.createManyAndReturn
      .mockResolvedValueOnce([
        {
          id: 'n-1',
          userId: 'participant',
          tournamentId: 't-1',
          type: NotificationType.SCORE_UPDATE,
          content: 'Result changed',
          deduplicationKey: 'result-1:user:participant',
          data: null,
          isRead: false,
          createdAt: new Date(),
        },
      ])
      .mockResolvedValueOnce([]);
    const emitted: string[] = [];
    const subscription = events.events$.subscribe((item) =>
      emitted.push(item.id),
    );
    const event = {
      tournamentId: 't-1',
      type: NotificationType.SCORE_UPDATE,
      content: 'Result changed',
      sourceKey: 'result-1',
    };

    await service.createForTournamentEvent(event);
    await service.createForTournamentEvent(event);

    expect(notification.createManyAndReturn).toHaveBeenCalledTimes(2);
    expect(emitted).toEqual(['n-1']);
    subscription.unsubscribe();
  });

  it('merges visible followers with participants and deduplicates overlapping roles', async () => {
    const { service, prisma, notification } = harness();
    jest.mocked(prisma.tournament.findUnique).mockResolvedValue({
      organizerId: 'organizer',
      visibility: Visibility.PUBLIC,
      moderationStatus: ModerationStatus.ACTIVE,
      teams: [
        {
          status: RegistrationStatus.APPROVED,
          captainId: 'participant-follower',
          members: [],
        },
      ],
      favorites: [
        {
          user: {
            id: 'participant-follower',
            role: Role.SIGNED_UP_USER,
          },
        },
        {
          user: { id: 'organizer', role: Role.SIGNED_UP_USER },
        },
        {
          user: { id: 'follower', role: Role.SIGNED_UP_USER },
        },
      ],
    } as never);

    const result = await service.createForTournamentEvent({
      tournamentId: 't-1',
      type: NotificationType.TOURNAMENT_STATUS,
      content: 'Tournament status updated',
      sourceKey: 'tournament:t-1:status:REGISTRATION:ONGOING',
    });

    const recipientIds = notification.createManyAndReturn.mock.calls[0][0].data
      .map((item: { userId: string }) => item.userId)
      .sort();
    expect(recipientIds).toEqual([
      'follower',
      'organizer',
      'participant-follower',
    ]);
    expect(result).toEqual(
      expect.objectContaining({ recipientCount: 3, createdCount: 3 }),
    );
  });

  it('stops future follower delivery after the Favorite relation is absent', async () => {
    const { service, prisma, notification } = harness();
    const tournament = {
      organizerId: 'organizer',
      visibility: Visibility.PUBLIC,
      moderationStatus: ModerationStatus.ACTIVE,
      teams: [],
      favorites: [{ user: { id: 'follower', role: Role.SIGNED_UP_USER } }],
    };
    jest
      .mocked(prisma.tournament.findUnique)
      .mockResolvedValueOnce(tournament as never)
      .mockResolvedValueOnce({ ...tournament, favorites: [] } as never);

    await service.createForTournamentEvent({
      tournamentId: 't-1',
      type: NotificationType.TOURNAMENT_STATUS,
      content: 'Tournament started',
      sourceKey: 'status-1',
    });
    await service.createForTournamentEvent({
      tournamentId: 't-1',
      type: NotificationType.TOURNAMENT_STATUS,
      content: 'Tournament completed',
      sourceKey: 'status-2',
    });

    expect(notification.createManyAndReturn).toHaveBeenCalledTimes(1);
    expect(notification.createManyAndReturn.mock.calls[0][0].data).toEqual([
      expect.objectContaining({ userId: 'follower' }),
    ]);
  });

  it('does not notify a follower or participant who can no longer view a hidden tournament', async () => {
    const { service, prisma, notification } = harness();
    jest.mocked(prisma.tournament.findUnique).mockResolvedValue({
      organizerId: 'organizer',
      visibility: Visibility.PUBLIC,
      moderationStatus: ModerationStatus.HIDDEN_BY_ADMIN,
      teams: [
        {
          status: RegistrationStatus.APPROVED,
          captainId: 'former-viewer',
          members: [],
        },
      ],
      favorites: [{ user: { id: 'former-viewer', role: Role.SIGNED_UP_USER } }],
    } as never);

    await expect(
      service.createForTournamentEvent({
        tournamentId: 't-1',
        type: NotificationType.TOURNAMENT_STATUS,
        content: 'Tournament status updated',
        sourceKey: 'private-status',
      }),
    ).resolves.toEqual(
      expect.objectContaining({ recipientCount: 0, createdCount: 0 }),
    );
    expect(notification.createManyAndReturn).not.toHaveBeenCalled();
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
      service.findForUser('user-1', { page: 2, limit: 20, isRead: false }),
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
