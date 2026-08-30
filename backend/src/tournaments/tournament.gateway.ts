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
  RegistrationStatus,
  Role,
  Visibility,
} from '@prisma/client';
import { Server, Socket } from 'socket.io';
import { Subscription } from 'rxjs';
import { OnModuleDestroy } from '@nestjs/common';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentEventsService } from './tournament-events.service';
import { NotificationEventsService } from '../notifications/notification-events.service';
import { tournamentVisibilityPolicy } from '../common/policies/tournament-visibility.policy';

interface TournamentSocketData {
  user?: { id: string; role: Role };
  readOnly: boolean;
}

@WebSocketGateway({ namespace: '/tournaments', cors: true })
export class TournamentGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleDestroy
{
  @WebSocketServer()
  server!: Server;

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
      this.server
        .to(TournamentGateway.room(message.tournamentId))
        .emit(message.event, message.payload);
    });
    this.notificationSubscription = this.notificationEvents.events$.subscribe(
      (notification) => {
        this.server
          .to(TournamentGateway.userRoom(notification.userId))
          .emit('notification', notification);
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
      data.user = { id: user.id, role: user.role };
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
    @MessageBody() body: { tournamentId?: string },
  ) {
    const tournamentId = body?.tournamentId;
    if (!tournamentId) throw new WsException('tournamentId is required');
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

    const user = (client.data as TournamentSocketData).user;
    let isRelatedParticipant = false;
    if (
      user &&
      tournament.visibility === Visibility.PRIVATE &&
      tournament.moderationStatus !== ModerationStatus.HIDDEN_BY_ADMIN &&
      !tournamentVisibilityPolicy.canView({ ...tournament, user })
    ) {
      const team = await this.prisma.team.findFirst({
        where: {
          tournamentId,
          status: {
            in: [RegistrationStatus.PENDING, RegistrationStatus.APPROVED],
          },
          OR: [
            { captainId: user.id },
            { members: { some: { userId: user.id } } },
          ],
        },
        select: { id: true },
      });
      isRelatedParticipant = team !== null;
    }

    if (
      !tournamentVisibilityPolicy.canView({
        ...tournament,
        user,
        isRelatedParticipant,
      })
    ) {
      throw new WsException('Tournament access denied');
    }

    const room = TournamentGateway.room(tournamentId);
    await client.join(room);
    return { tournamentId, room, readOnly: true };
  }

  static room(tournamentId: string): string {
    return `tournament:${tournamentId}`;
  }

  static userRoom(userId: string): string {
    return `user:${userId}`;
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
