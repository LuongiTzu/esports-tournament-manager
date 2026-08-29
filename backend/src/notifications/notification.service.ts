import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTournamentNotificationDto,
  NotificationScope,
} from './dto/notification.dto';
import { NotificationEventsService } from './notification-events.service';
import {
  NotificationData,
  NotificationInput,
  NotificationPublisher,
} from '../common/ports/notification-publisher';
import { NotificationQueryService } from './notification-query.service';
import { tournamentVisibilityPolicy } from '../common/policies/tournament-visibility.policy';
import {
  ACTIVITY_EMAIL_PUBLISHER,
  ActivityEmailPublisher,
  NOOP_ACTIVITY_EMAIL_PUBLISHER,
} from '../common/ports/activity-email-publisher';

type NotificationClient = Pick<PrismaService, 'notification'>;

@Injectable()
export class NotificationService implements NotificationPublisher {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: NotificationEventsService,
    private readonly queries: NotificationQueryService = new NotificationQueryService(
      prisma,
    ),
    @Inject(ACTIVITY_EMAIL_PUBLISHER)
    private readonly activityEmails: ActivityEmailPublisher = NOOP_ACTIVITY_EMAIL_PUBLISHER,
  ) {}

  async createNotification(
    input: NotificationInput & {
      userId: string;
    },
    client: NotificationClient = this.prisma,
    emit = true,
  ) {
    const { sourceKey, ...base } = input;
    if (!sourceKey) {
      const notification = await client.notification.create({ data: base });
      if (emit) this.emitCreated(notification);
      return notification;
    }

    const deduplicationKey = `${sourceKey}:user:${input.userId}`;
    const [created] = await client.notification.createManyAndReturn({
      data: [{ ...base, deduplicationKey }],
      skipDuplicates: true,
    });
    if (created) {
      if (emit) this.emitCreated(created);
      return created;
    }
    return client.notification.findUniqueOrThrow({
      where: { deduplicationKey },
    });
  }

  emitCreated(notification: Prisma.NotificationGetPayload<object>): void {
    this.events.publish(notification);
    void this.activityEmails
      .publish({
        kind: 'NOTIFICATION_CREATED',
        notification: {
          userId: notification.userId,
          type: notification.type,
          data: notification.data,
          tournamentId: notification.tournamentId,
        },
      })
      .catch((error: unknown) => {
        this.logger.error(
          `Notification ${notification.id} was emitted but email publishing failed`,
          error instanceof Error ? error.stack : String(error),
        );
      });
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
        status:
          dto.scope === NotificationScope.WHOLE_TOURNAMENT
            ? RegistrationStatus.APPROVED
            : undefined,
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
      this.createForUsers(
        {
          userIds,
          type: dto.type,
          content: dto.content.trim(),
          data: { kind: 'TOURNAMENT_ANNOUNCEMENT' },
          tournamentId: tournament.id,
        },
        tx,
        false,
      ),
    );
    notifications.forEach((notification) => this.emitCreated(notification));
    return { scope: dto.scope, recipientCount: userIds.length, notifications };
  }

  async createForTournamentEvent(data: {
    tournamentId: string;
    type: NotificationType;
    content: string;
    data?: NotificationData;
    sourceKey: string;
  }) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: data.tournamentId },
      select: {
        organizerId: true,
        visibility: true,
        moderationStatus: true,
        teams: {
          select: {
            status: true,
            captainId: true,
            members: {
              where: { userId: { not: null } },
              select: { userId: true },
            },
          },
        },
        favorites: {
          select: {
            user: { select: { id: true, role: true } },
          },
        },
      },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');

    const relatedUserIds = new Set(
      tournament.teams.flatMap((team) => [
        team.captainId,
        ...team.members
          .map((member) => member.userId)
          .filter((userId): userId is string => userId !== null),
      ]),
    );
    const participantCandidates = uniqueUserIds(
      tournament.teams
        .filter((team) => team.status === RegistrationStatus.APPROVED)
        .flatMap((team) => [
          team.captainId,
          ...team.members.map((member) => member.userId),
        ]),
    );
    const participantUsers = await this.prisma.user.findMany({
      where: { id: { in: participantCandidates } },
      select: { id: true, role: true },
    });
    const participantUserIds = participantUsers.flatMap((user) =>
      tournamentVisibilityPolicy.canView({
        ...tournament,
        user,
        isRelatedParticipant: true,
      })
        ? [user.id]
        : [],
    );
    const followerUserIds = tournament.favorites.flatMap(({ user }) =>
      tournamentVisibilityPolicy.canView({
        ...tournament,
        user,
        isRelatedParticipant: relatedUserIds.has(user.id),
      })
        ? [user.id]
        : [],
    );
    const userIds = [...participantUserIds, ...followerUserIds];
    const notifications = await this.createForUsers({ ...data, userIds });
    return {
      recipientCount: uniqueUserIds(userIds).length,
      createdCount: notifications.length,
      notifications,
    };
  }

  async createForMatchEvent(data: {
    tournamentId: string;
    teamIds: Array<string | null | undefined>;
    type: NotificationType;
    content: string;
    data?: NotificationData;
    sourceKey: string;
  }) {
    const { teamIds: rawTeamIds, ...notificationInput } = data;
    const teamIds = [...new Set(rawTeamIds.filter(isUserId))];
    if (teamIds.length === 0) {
      return { recipientCount: 0, createdCount: 0, notifications: [] };
    }
    const teams = await this.prisma.team.findMany({
      where: { tournamentId: data.tournamentId, id: { in: teamIds } },
      select: {
        captainId: true,
        members: {
          where: { userId: { not: null } },
          select: { userId: true },
        },
      },
    });
    const userIds = teams.flatMap((team) => [
      team.captainId,
      ...team.members.map((member) => member.userId),
    ]);
    const notifications = await this.createForUsers({
      ...notificationInput,
      userIds,
    });
    return {
      recipientCount: uniqueUserIds(userIds).length,
      createdCount: notifications.length,
      notifications,
    };
  }

  async createForUsers(
    input: NotificationInput & {
      userIds: Array<string | null | undefined>;
    },
    client: NotificationClient = this.prisma,
    emit = true,
  ) {
    const { userIds: rawUserIds, sourceKey, ...notification } = input;
    const userIds = uniqueUserIds(rawUserIds);
    if (userIds.length === 0) return [];

    const notifications = sourceKey
      ? await client.notification.createManyAndReturn({
          data: userIds.map((userId) => ({
            ...notification,
            userId,
            deduplicationKey: `${sourceKey}:user:${userId}`,
          })),
          skipDuplicates: true,
        })
      : await Promise.all(
          userIds.map((userId) =>
            client.notification.create({ data: { ...notification, userId } }),
          ),
        );
    if (emit) {
      notifications.forEach((item) => this.emitCreated(item));
    }
    return notifications;
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

function isUserId(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.length > 0;
}

function uniqueUserIds(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter(isUserId))];
}
