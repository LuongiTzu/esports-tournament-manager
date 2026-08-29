import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModerationStatus, NotificationType } from '@prisma/client';
import {
  NOTIFICATION_PUBLISHER,
  NotificationPublisher,
} from '../common/ports/notification-publisher';
import { PrismaService } from '../prisma/prisma.service';
import { withTournamentGameDisplayName } from './domain/tournament-game-display';

@Injectable()
export class TournamentModerationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notifications: NotificationPublisher,
  ) {}
  async list(moderationStatus?: ModerationStatus) {
    const tournaments = await this.prisma.tournament.findMany({
      where: { moderationStatus },
      orderBy: [{ reports: { _count: 'desc' } }, { createdAt: 'desc' }],
      include: {
        organizer: { select: { id: true, displayName: true, email: true } },
        game: { select: { id: true, code: true, name: true } },
        _count: { select: { reports: true } },
      },
    });
    return tournaments.map(withTournamentGameDisplayName);
  }
  async moderate(
    id: string,
    moderationStatus: ModerationStatus,
    reason?: string,
  ) {
    if (
      moderationStatus === ModerationStatus.HIDDEN_BY_ADMIN &&
      !reason?.trim()
    )
      throw new BadRequestException(
        'Reason is required when hiding tournament',
      );
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      select: { id: true, organizerId: true, moderationStatus: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    const updated = await this.prisma.tournament.update({
      where: { id },
      data: { moderationStatus },
    });
    if (moderationStatus !== tournament.moderationStatus) {
      await this.notifications.createNotification({
        userId: tournament.organizerId,
        type: NotificationType.ADMIN_WARNING,
        content:
          moderationStatus === ModerationStatus.HIDDEN_BY_ADMIN
            ? 'Tournament hidden by an administrator'
            : 'Tournament restored by an administrator',
        data: {
          kind: 'TOURNAMENT_MODERATION',
          moderationStatus,
          previousModerationStatus: tournament.moderationStatus,
          reason:
            moderationStatus === ModerationStatus.HIDDEN_BY_ADMIN
              ? reason!.trim()
              : undefined,
        },
        tournamentId: tournament.id,
        sourceKey: `tournament:${tournament.id}:moderation:${updated.updatedAt?.toISOString() ?? `${tournament.moderationStatus}:${moderationStatus}`}`,
      });
    }
    return updated;
  }
  async verify(id: string, explicit?: boolean) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      select: { id: true, isVerified: true, moderationStatus: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    const nextValue = explicit ?? !tournament.isVerified;
    if (
      nextValue &&
      tournament.moderationStatus === ModerationStatus.HIDDEN_BY_ADMIN
    )
      throw new BadRequestException(
        'A hidden tournament cannot receive the verified trust label',
      );
    return this.prisma.tournament.update({
      where: { id },
      data: { isVerified: nextValue },
    });
  }
}
