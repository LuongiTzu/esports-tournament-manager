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

type NotificationClient = Pick<PrismaService, 'notification'>;

@Injectable()
export class NotificationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly events: NotificationEventsService,
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
    const page = query.page ?? 1;
    const limit = Math.min(50, query.limit ?? 20);
    const where: Prisma.NotificationWhereInput = { userId };
    if (query.isRead !== undefined) {
      where.isRead = query.isRead;
    }
    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          tournament: { select: { id: true, name: true, slug: true } },
        },
      }),
      this.prisma.notification.count({ where }),
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async markRead(userId: string, notificationId: string) {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });
    if (!notification) throw new NotFoundException('Notification not found');
    return this.prisma.notification.update({
      where: { id: notificationId },
      data: { isRead: true },
    });
  }

  async markAllRead(userId: string) {
    const result = await this.prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });
    return { updatedCount: result.count };
  }

  async unreadCount(userId: string) {
    const count = await this.prisma.notification.count({
      where: { userId, isRead: false },
    });
    return { count };
  }
}
