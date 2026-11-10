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
    leave: jest.fn().mockResolvedValue(undefined),
  } as unknown as Socket;
}

function authenticatedSocket(id: string, role: Role = Role.SIGNED_UP_USER) {
  const client = socket();
  client.data = { readOnly: true, user: { id, role, tokenVersion: 1 } };
  return client;
}

async function flushRealtime() {
  await new Promise<void>((resolve) => setImmediate(resolve));
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
    user: {
      findUnique: jest
        .fn()
        .mockImplementation(({ where }: { where: { id: string } }) => ({
          id: where.id,
          role: where.id === 'admin' ? Role.ADMIN : Role.SIGNED_UP_USER,
          isLocked: false,
          tokenVersion: 1,
        })),
    },
    tournament: { findUnique: jest.fn().mockResolvedValue(tournament) },
    team: { findFirst: jest.fn() },
    tournamentStaff: { findUnique: jest.fn().mockResolvedValue(null) },
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
      user: { id: 'user-1', role: Role.SIGNED_UP_USER, tokenVersion: 2 },
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
    const client = authenticatedSocket('unrelated');

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
    const client = authenticatedSocket('member');

    await expect(
      gateway.joinTournament(client, { tournamentId: 't-1' }),
    ).resolves.toEqual(expect.objectContaining({ room: 'tournament:t-1' }));
  });

  it('allows tournament staff into a private room', async () => {
    const { gateway, prisma } = harness({
      id: 't-1',
      organizerId: 'organizer',
      visibility: Visibility.PRIVATE,
      moderationStatus: ModerationStatus.ACTIVE,
    });
    jest.mocked(prisma.team.findFirst).mockResolvedValue(null);
    jest.mocked(prisma.tournamentStaff.findUnique).mockResolvedValue({
      id: 'staff-1',
    } as never);

    await expect(
      gateway.joinTournament(authenticatedSocket('staff'), {
        tournamentId: 't-1',
      }),
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
    const client = authenticatedSocket(user.id, user.role);

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
      const client = user ? authenticatedSocket(user.id, user.role) : socket();

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
      const client = authenticatedSocket(user.id, user.role);

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

  it('leaves only the requested tournament room', async () => {
    const { gateway } = harness();
    const client = socket();

    await expect(
      gateway.leaveTournament(client, { tournamentId: 't-1' }),
    ).resolves.toEqual({
      tournamentId: 't-1',
      room: 'tournament:t-1',
    });
    expect(client.leave).toHaveBeenCalledWith('tournament:t-1');
  });

  it('rejects a leave request without a tournament id', async () => {
    const { gateway } = harness();

    await expect(gateway.leaveTournament(socket(), {})).rejects.toThrow(
      'tournamentId is required',
    );
  });

  it('emits created notifications to the recipient user room', async () => {
    const { gateway, notificationEvents } = harness();
    const client = authenticatedSocket('user-1');
    const fetchSockets = jest.fn().mockResolvedValue([client]);
    const inRoom = jest.fn().mockReturnValue({ fetchSockets });
    gateway.server = { in: inRoom } as unknown as Server;
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

    await flushRealtime();
    expect(inRoom).toHaveBeenCalledWith('user:user-1');
    expect(client.emit).toHaveBeenCalledWith('notification', notification);
    gateway.onModuleDestroy();
  });

  it('does not deliver notifications after the user is locked', async () => {
    const { gateway, notificationEvents, prisma } = harness();
    const client = authenticatedSocket('user-1');
    gateway.server = {
      in: jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([client]),
      }),
    } as unknown as Server;
    jest.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-1',
      role: Role.SIGNED_UP_USER,
      isLocked: true,
      tokenVersion: 1,
    } as never);
    gateway.afterInit();

    notificationEvents.publish({ userId: 'user-1' } as never);
    await flushRealtime();

    expect(client.emit).not.toHaveBeenCalledWith(
      'notification',
      expect.anything(),
    );
    expect(client.disconnect).toHaveBeenCalledWith(true);
    gateway.onModuleDestroy();
  });

  it('removes a subscriber when a public tournament becomes private', async () => {
    const { gateway, events, prisma } = harness();
    const client = socket();
    gateway.server = {
      in: jest.fn().mockReturnValue({
        fetchSockets: jest.fn().mockResolvedValue([client]),
      }),
    } as unknown as Server;
    jest.mocked(prisma.tournament.findUnique).mockResolvedValue({
      id: 't-1',
      organizerId: 'organizer',
      visibility: Visibility.PRIVATE,
      moderationStatus: ModerationStatus.ACTIVE,
    } as never);
    gateway.afterInit();

    events.publish({
      tournamentId: 't-1',
      event: 'matchUpdated',
      payload: { id: 'm-1' },
    });
    await flushRealtime();

    expect(client.emit).not.toHaveBeenCalledWith(
      'matchUpdated',
      expect.anything(),
    );
    expect(client.leave).toHaveBeenCalledWith('tournament:t-1');
    gateway.onModuleDestroy();
  });

  it.each(TOURNAMENT_EVENT_NAMES)(
    'forwards %s with its payload to the tournament room',
    async (event) => {
      const { gateway, events } = harness();
      const client = socket();
      const fetchSockets = jest.fn().mockResolvedValue([client]);
      const inRoom = jest.fn().mockReturnValue({ fetchSockets });
      gateway.server = { in: inRoom } as unknown as Server;
      gateway.afterInit();
      const payload = { id: `${event}-1` };

      events.publish({ tournamentId: 't-1', event, payload });

      await flushRealtime();
      expect(inRoom).toHaveBeenCalledWith('tournament:t-1');
      expect(client.emit).toHaveBeenCalledWith(event, {
        tournamentId: 't-1',
        data: payload,
      });
      gateway.onModuleDestroy();
    },
  );
});
