import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
  WsException,
} from '@nestjs/websockets';
import {
  ModerationStatus,
  Notification,
  RegistrationStatus,
  Role,
  Visibility,
} from '@prisma/client';
import { RemoteSocket, Server, Socket } from 'socket.io';
import { Subscription } from 'rxjs';
import { Logger, OnModuleDestroy } from '@nestjs/common';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentEventsService } from './tournament-events.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { configuredCorsOrigin } from '../common/config/browser-origins';
import { tournamentVisibilityPolicy } from '../common/policies/tournament-visibility.policy';
import { TournamentRealtimeEvent } from '../common/ports/tournament-event-publisher';

interface TournamentSocketData {
  user?: { id: string; role: Role; tokenVersion: number; expiresAt?: number };
  readOnly: boolean;
}

const MAX_TOURNAMENT_ID_LENGTH = 128;
const MAX_SOCKET_MESSAGE_BYTES = 64 * 1024;

type TournamentClient =
  | Socket
  | RemoteSocket<
      Record<string, (...args: unknown[]) => void>,
      TournamentSocketData
    >;

@WebSocketGateway({
  namespace: '/tournaments',
  maxHttpBufferSize: MAX_SOCKET_MESSAGE_BYTES,
  cors: {
    origin: configuredCorsOrigin,
    credentials: true,
  },
})
export class TournamentGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(TournamentGateway.name);
  private eventSubscription?: Subscription;
  private notificationSubscription?: Subscription;

  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly events: TournamentEventsService,
    private readonly notificationEvents: NotificationEventsService,
  ) {}

  afterInit(): void {
    this.eventSubscription = this.events.events$.subscribe((message) => {
      void this.emitTournamentEvent(message).catch((error: unknown) =>
        this.logger.error('Tournament realtime authorization failed', error),
      );
    });
    this.notificationSubscription = this.notificationEvents.events$.subscribe(
      (notification) => {
        void this.emitNotification(notification).catch((error: unknown) =>
          this.logger.error(
            'Notification realtime authorization failed',
            error,
          ),
        );
      },
    );
  }

  async handleConnection(client: Socket): Promise<void> {
    const token = this.handshakeToken(client);
    const data = client.data as TournamentSocketData;
    data.readOnly = true;
    if (!token) return;
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token);
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, role: true, isLocked: true, tokenVersion: true },
      });
      if (
        !user ||
        user.isLocked ||
        user.tokenVersion !== payload.tokenVersion
      ) {
        throw new Error('Invalid user session');
      }
      data.user = {
        id: user.id,
        role: user.role,
        tokenVersion: user.tokenVersion,
        expiresAt:
          typeof payload.exp === 'number' ? payload.exp * 1000 : undefined,
      };
      await client.join(TournamentGateway.userRoom(user.id));
    } catch {
      client.emit('authenticationError', { message: 'Invalid access token' });
      client.disconnect(true);
    }
  }

  handleDisconnect(): void {
    // Socket.IO removes disconnected clients from rooms automatically.
  }

  onModuleDestroy(): void {
    this.eventSubscription?.unsubscribe();
    this.notificationSubscription?.unsubscribe();
  }

  @SubscribeMessage('joinTournament')
  async joinTournament(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    const tournamentId = tournamentIdFromMessage(body);
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: {
        id: true,
        organizerId: true,
        visibility: true,
        moderationStatus: true,
      },
    });
    if (!tournament) throw new WsException('Tournament not found');

    if (!(await this.canViewTournament(client, tournament))) {
      throw new WsException('Tournament access denied');
    }

    const room = TournamentGateway.room(tournamentId);
    await client.join(room);
    return { tournamentId, room, readOnly: true };
  }

  @SubscribeMessage('leaveTournament')
  async leaveTournament(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: unknown,
  ) {
    const tournamentId = tournamentIdFromMessage(body);

    const room = TournamentGateway.room(tournamentId);
    await client.leave(room);
    return { tournamentId, room };
  }

  static room(tournamentId: string): string {
    return `tournament:${tournamentId}`;
  }

  static userRoom(userId: string): string {
    return `user:${userId}`;
  }

  private async emitTournamentEvent(
    message: TournamentRealtimeEvent,
  ): Promise<void> {
    const room = TournamentGateway.room(message.tournamentId);
    const clients = await this.server.in(room).fetchSockets();
    if (!clients.length) return;
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: message.tournamentId },
      select: {
        id: true,
        organizerId: true,
        visibility: true,
        moderationStatus: true,
      },
    });
    for (const client of clients) {
      try {
        if (tournament && (await this.canViewTournament(client, tournament))) {
          client.emit(message.event, {
            tournamentId: message.tournamentId,
            data: message.payload,
          });
        } else {
          void client.leave(room);
        }
      } catch {
        void client.leave(room);
      }
    }
  }

  private async emitNotification(notification: Notification): Promise<void> {
    const clients = await this.server
      .in(TournamentGateway.userRoom(notification.userId))
      .fetchSockets();
    for (const client of clients) {
      try {
        const user = await this.currentUser(client);
        if (user?.id === notification.userId) {
          client.emit('notification', notification);
        }
      } catch {
        void client.leave(TournamentGateway.userRoom(notification.userId));
      }
    }
  }

  private async currentUser(
    client: TournamentClient,
  ): Promise<{ id: string; role: Role } | undefined> {
    const session = (client.data as TournamentSocketData).user;
    if (!session) return undefined;
    if (session.expiresAt !== undefined && session.expiresAt <= Date.now()) {
      client.disconnect(true);
      throw new WsException('Session expired');
    }
    const user = await this.prisma.user.findUnique({
      where: { id: session.id },
      select: { id: true, role: true, isLocked: true, tokenVersion: true },
    });
    if (!user || user.isLocked || user.tokenVersion !== session.tokenVersion) {
      client.disconnect(true);
      throw new WsException('Session expired');
    }
    return { id: user.id, role: user.role };
  }

  private async canViewTournament(
    client: TournamentClient,
    tournament: {
      id: string;
      organizerId: string;
      visibility: Visibility;
      moderationStatus: ModerationStatus;
    },
  ): Promise<boolean> {
    const user = await this.currentUser(client);
    if (tournamentVisibilityPolicy.canView({ ...tournament, user }))
      return true;
    if (
      !user ||
      tournament.visibility !== Visibility.PRIVATE ||
      tournament.moderationStatus === ModerationStatus.HIDDEN_BY_ADMIN
    ) {
      return false;
    }
    const [team, staff] = await Promise.all([
      this.prisma.team.findFirst({
        where: {
          tournamentId: tournament.id,
          status: {
            in: [RegistrationStatus.PENDING, RegistrationStatus.APPROVED],
          },
          OR: [
            { captainId: user.id },
            { members: { some: { userId: user.id } } },
          ],
        },
        select: { id: true },
      }),
      this.prisma.tournamentStaff.findUnique({
        where: {
          tournamentId_userId: { tournamentId: tournament.id, userId: user.id },
        },
        select: { id: true },
      }),
    ]);
    return tournamentVisibilityPolicy.canView({
      ...tournament,
      user,
      isRelatedParticipant: team !== null,
      isTournamentStaff: staff !== null,
    });
  }

  private handshakeToken(client: Socket): string | undefined {
    const authToken = (client.handshake.auth as { token?: unknown })?.token;
    const header = client.handshake.headers.authorization;
    const token =
      typeof authToken === 'string'
        ? authToken
        : typeof header === 'string' && header.startsWith('Bearer ')
          ? header.slice(7)
          : undefined;
    return token?.startsWith('Bearer ') ? token.slice(7) : token;
  }
}

function tournamentIdFromMessage(body: unknown): string {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new WsException('Invalid tournamentId');
  }
  const value = (body as Record<string, unknown>).tournamentId;
  if (value === undefined || value === null || value === '') {
    throw new WsException('tournamentId is required');
  }
  if (
    typeof value !== 'string' ||
    value.length > MAX_TOURNAMENT_ID_LENGTH ||
    value !== value.trim()
  ) {
    throw new WsException('Invalid tournamentId');
  }
  return value;
}
