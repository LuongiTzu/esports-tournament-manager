/* eslint-disable @typescript-eslint/unbound-method */
import { JwtService } from '@nestjs/jwt';
import { ModerationStatus, Role, Visibility } from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { PrismaService } from '../prisma/prisma.service';
import {
  TOURNAMENT_EVENT_NAMES,
  TournamentEventsService,
} from './tournament-events.service';
import { TournamentGateway } from './tournament.gateway';
import { NotificationEventsService } from '../notifications/notification-events.service';

function socket(token?: string) {
  return {
    data: {},
    handshake: { auth: token ? { token } : {}, headers: {} },
    emit: jest.fn(),
    disconnect: jest.fn(),
    join: jest.fn().mockResolvedValue(undefined),
  } as unknown as Socket;
}

function harness(
  tournament: {
    id: string;
    organizerId: string;
    visibility: Visibility;
    moderationStatus: ModerationStatus;
  } = {
    id: 't-1',
    organizerId: 'organizer',
    visibility: Visibility.PUBLIC,
    moderationStatus: ModerationStatus.ACTIVE,
  },
) {
  const jwt = { verifyAsync: jest.fn() } as unknown as JwtService;
  const prisma = {
    user: { findUnique: jest.fn() },
    tournament: { findUnique: jest.fn().mockResolvedValue(tournament) },
    team: { findFirst: jest.fn() },
  } as unknown as PrismaService;
  const events = new TournamentEventsService();
  const notificationEvents = new NotificationEventsService();
  return {
    gateway: new TournamentGateway(jwt, prisma, events, notificationEvents),
    jwt,
    prisma,
    events,
    notificationEvents,
  };
}

describe('TournamentGateway', () => {
  it('authenticates a valid JWT handshake against the current user session', async () => {
    const { gateway, jwt, prisma } = harness();
    jest.mocked(jwt.verifyAsync).mockResolvedValue({
      sub: 'user-1',
      email: 'u@example.com',
      role: Role.SIGNED_UP_USER,
      tokenVersion: 2,
    });
    jest.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      role: Role.SIGNED_UP_USER,
      isLocked: false,
      tokenVersion: 2,
    } as never);
    const client = socket('valid-token');

    await gateway.handleConnection(client);

    expect(client.data).toEqual({
      user: { id: 'user-1', role: Role.SIGNED_UP_USER },
      readOnly: true,
    });
    expect(client.join).toHaveBeenCalledWith('user:user-1');
    expect(client.disconnect).not.toHaveBeenCalled();
  });

  it('disconnects a client that supplies an invalid token', async () => {
    const { gateway, jwt } = harness();
    jest.mocked(jwt.verifyAsync).mockRejectedValue(new Error('invalid'));
    const client = socket('invalid-token');

    await gateway.handleConnection(client);

    expect(client.emit).toHaveBeenCalledWith('authenticationError', {
      message: 'Invalid access token',
    });
    expect(client.disconnect).toHaveBeenCalledWith(true);
  });

  it('allows anonymous clients into a public read-only room', async () => {
    const { gateway } = harness();
    const client = socket();
    await gateway.handleConnection(client);

    await expect(
      gateway.joinTournament(client, { tournamentId: 't-1' }),
    ).resolves.toEqual({
      tournamentId: 't-1',
      room: 'tournament:t-1',
      readOnly: true,
    });
    expect(client.join).toHaveBeenCalledWith('tournament:t-1');
  });

  it('denies an anonymous client access to a private room', async () => {
    const { gateway } = harness({
      id: 't-1',
      organizerId: 'organizer',
      visibility: Visibility.PRIVATE,
      moderationStatus: ModerationStatus.ACTIVE,
    });

    await expect(
      gateway.joinTournament(socket(), { tournamentId: 't-1' }),
    ).rejects.toThrow('Tournament access denied');
  });

  it('denies an unrelated authenticated client access to a private room', async () => {
    const { gateway, prisma } = harness({
      id: 't-1',
      organizerId: 'organizer',
      visibility: Visibility.PRIVATE,
      moderationStatus: ModerationStatus.ACTIVE,
    });
    jest.mocked(prisma.team.findFirst).mockResolvedValue(null);
    const client = socket();
    client.data = {
      readOnly: true,
      user: { id: 'unrelated', role: Role.SIGNED_UP_USER },
    };

    await expect(
      gateway.joinTournament(client, { tournamentId: 't-1' }),
    ).rejects.toThrow('Tournament access denied');
  });

  it('allows an authorized team member into a private room', async () => {
    const { gateway, prisma } = harness({
      id: 't-1',
      organizerId: 'organizer',
      visibility: Visibility.PRIVATE,
      moderationStatus: ModerationStatus.ACTIVE,
    });
    jest
      .mocked(prisma.team.findFirst)
      .mockResolvedValue({ id: 'team-1' } as never);
    const client = socket();
    client.data = {
      readOnly: true,
      user: { id: 'member', role: Role.SIGNED_UP_USER },
    };

    await expect(
      gateway.joinTournament(client, { tournamentId: 't-1' }),
    ).resolves.toEqual(expect.objectContaining({ room: 'tournament:t-1' }));
  });

  it.each([
    ['organizer', { id: 'organizer', role: Role.SIGNED_UP_USER }],
    ['admin', { id: 'admin', role: Role.ADMIN }],
  ] as const)('allows the %s into a private room', async (_actor, user) => {
    const { gateway, prisma } = harness({
      id: 't-1',
      organizerId: 'organizer',
      visibility: Visibility.PRIVATE,
      moderationStatus: ModerationStatus.ACTIVE,
    });
    const client = socket();
    client.data = { readOnly: true, user };

    await expect(
      gateway.joinTournament(client, { tournamentId: 't-1' }),
    ).resolves.toEqual(expect.objectContaining({ room: 'tournament:t-1' }));
    expect(prisma.team.findFirst).not.toHaveBeenCalled();
  });

  it.each([
    ['anonymous', undefined],
    ['unrelated user', { id: 'unrelated', role: Role.SIGNED_UP_USER }],
    ['participant', { id: 'member', role: Role.SIGNED_UP_USER }],
  ] as const)(
    'denies %s access to a hidden tournament room',
    async (_actor, user) => {
      const { gateway, prisma } = harness({
        id: 't-1',
        organizerId: 'organizer',
        visibility: Visibility.PUBLIC,
        moderationStatus: ModerationStatus.HIDDEN_BY_ADMIN,
      });
      jest
        .mocked(prisma.team.findFirst)
        .mockResolvedValue(
          user?.id === 'member' ? ({ id: 'team-1' } as never) : null,
        );
      const client = socket();
      if (user) client.data = { readOnly: true, user };

      await expect(
        gateway.joinTournament(client, { tournamentId: 't-1' }),
      ).rejects.toThrow('Tournament access denied');
      expect(prisma.team.findFirst).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['organizer', { id: 'organizer', role: Role.SIGNED_UP_USER }],
    ['admin', { id: 'admin', role: Role.ADMIN }],
  ] as const)(
    'allows the %s into a hidden tournament room',
    async (_actor, user) => {
      const { gateway } = harness({
        id: 't-1',
        organizerId: 'organizer',
        visibility: Visibility.PRIVATE,
        moderationStatus: ModerationStatus.HIDDEN_BY_ADMIN,
      });
      const client = socket();
      client.data = { readOnly: true, user };

      await expect(
        gateway.joinTournament(client, { tournamentId: 't-1' }),
      ).resolves.toEqual(expect.objectContaining({ room: 'tournament:t-1' }));
    },
  );

  it('never accepts a client-selected user room', async () => {
    const { gateway } = harness();
    const client = socket();

    await gateway.joinTournament(client, {
      tournamentId: 't-1',
      userId: 'other-user',
    } as { tournamentId: string });

    expect(client.join).toHaveBeenCalledWith('tournament:t-1');
    expect(client.join).not.toHaveBeenCalledWith('user:other-user');
  });

  it('uses deterministic room names', () => {
    expect(TournamentGateway.room('abc')).toBe('tournament:abc');
    expect(TournamentGateway.userRoom('user-1')).toBe('user:user-1');
  });

  it('emits created notifications to the recipient user room', () => {
    const { gateway, notificationEvents } = harness();
    const emit = jest.fn();
    const to = jest.fn().mockReturnValue({ emit });
    gateway.server = { to } as unknown as Server;
    gateway.afterInit();
    const notification = {
      id: 'n-1',
      userId: 'user-1',
      tournamentId: 't-1',
      type: 'SYSTEM',
      content: 'Hello',
      data: null,
      deduplicationKey: null,
      isRead: false,
      createdAt: new Date(),
    } as const;

    notificationEvents.publish(notification);

    expect(to).toHaveBeenCalledWith('user:user-1');
    expect(emit).toHaveBeenCalledWith('notification', notification);
    gateway.onModuleDestroy();
  });

  it.each(TOURNAMENT_EVENT_NAMES)(
    'forwards %s with its payload to the tournament room',
    (event) => {
      const { gateway, events } = harness();
      const emit = jest.fn();
      const to = jest.fn().mockReturnValue({ emit });
      gateway.server = { to } as unknown as Server;
      gateway.afterInit();
      const payload = { id: `${event}-1` };

      events.publish({ tournamentId: 't-1', event, payload });

      expect(to).toHaveBeenCalledWith('tournament:t-1');
      expect(emit).toHaveBeenCalledWith(event, payload);
      gateway.onModuleDestroy();
    },
  );
});
