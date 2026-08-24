import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTournamentNotificationDto,
  NotificationScope,
} from './dto/notification.dto';
import { NotificationEventsService } from './notification-events.service';
import { NotificationPublisher } from '../common/ports/notification-publisher';
import { NotificationQueryService } from './notification-query.service';

type NotificationClient = Pick<PrismaService, 'notification'>;

@Injectable()
export class NotificationService implements NotificationPublisher {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: NotificationEventsService,
    private readonly queries: NotificationQueryService = new NotificationQueryService(
      prisma,
    ),
  ) {}

  async createNotification(
    data: {
      userId: string;
      type: NotificationType;
      content: string;
      tournamentId?: string | null;
    },
    client: NotificationClient = this.prisma,
    emit = true,
  ) {
    const notification = await client.notification.create({ data });
    if (emit) this.emitCreated(notification);
    return notification;
  }

  emitCreated(notification: Prisma.NotificationGetPayload<object>): void {
    this.events.publish(notification);
  }

  async createForTournament(
    slug: string,
    dto: CreateTournamentNotificationDto,
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    if (dto.scope === NotificationScope.TEAM && !dto.teamId) {
      throw new BadRequestException('teamId is required for TEAM scope');
    }
    if (dto.scope === NotificationScope.WHOLE_TOURNAMENT && dto.teamId) {
      throw new BadRequestException(
        'teamId is not allowed for WHOLE_TOURNAMENT scope',
      );
    }

    const teams = await this.prisma.team.findMany({
      where: {
        tournamentId: tournament.id,
        id: dto.scope === NotificationScope.TEAM ? dto.teamId : undefined,
      },
      select: {
        id: true,
        captainId: true,
        members: {
          where: { userId: { not: null } },
          select: { userId: true },
        },
      },
    });
    if (dto.scope === NotificationScope.TEAM && teams.length !== 1) {
      throw new BadRequestException('Team must belong to the tournament');
    }
    const userIds = [
      ...new Set(
        teams.flatMap((team) => [
          team.captainId,
          ...team.members.map((member) => member.userId!),
        ]),
      ),
    ];
    const notifications = await this.prisma.$transaction((tx) =>
      Promise.all(
        userIds.map((userId) =>
          this.createNotification(
            {
              userId,
              type: dto.type,
              content: dto.content.trim(),
              tournamentId: tournament.id,
            },
            tx,
            false,
          ),
        ),
      ),
    );
    notifications.forEach((notification) => this.emitCreated(notification));
    return { scope: dto.scope, recipientCount: userIds.length, notifications };
  }

  async createForTournamentEvent(data: {
    tournamentId: string;
    type: NotificationType;
    content: string;
    sourceKey: string;
  }) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: data.tournamentId },
      select: {
        organizerId: true,
        teams: {
          where: { status: RegistrationStatus.APPROVED },
          select: {
            captainId: true,
            members: {
              where: { userId: { not: null } },
              select: { userId: true },
            },
          },
        },
      },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');

    const userIds = [
      ...new Set([
        tournament.organizerId,
        ...tournament.teams.flatMap((team) => [
          team.captainId,
          ...team.members
            .map((member) => member.userId)
            .filter((userId): userId is string => userId !== null),
        ]),
      ]),
    ];
    const notifications = await this.prisma.notification.createManyAndReturn({
      data: userIds.map((userId) => ({
        userId,
        type: data.type,
        content: data.content,
        tournamentId: data.tournamentId,
        deduplicationKey: `${data.sourceKey}:user:${userId}`,
      })),
      skipDuplicates: true,
    });
    notifications.forEach((notification) => this.emitCreated(notification));
    return {
      recipientCount: userIds.length,
      createdCount: notifications.length,
      notifications,
    };
  }

  async findForUser(
    userId: string,
    query: { page?: number; limit?: number; isRead?: boolean },
  ) {
    return this.queries.findForUser(userId, query);
  }

  async markRead(userId: string, notificationId: string) {
    return this.queries.markRead(userId, notificationId);
  }

  async markAllRead(userId: string) {
    return this.queries.markAllRead(userId);
  }

  async unreadCount(userId: string) {
    return this.queries.unreadCount(userId);
  }
}
