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

@Injectable()
export class TournamentModerationService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notifications: NotificationPublisher,
  ) {}
  list(moderationStatus?: ModerationStatus) {
    return this.prisma.tournament.findMany({
      where: { moderationStatus },
      orderBy: [{ reports: { _count: 'desc' } }, { createdAt: 'desc' }],
      include: {
        organizer: { select: { id: true, displayName: true, email: true } },
        game: { select: { id: true, name: true } },
        _count: { select: { reports: true } },
      },
    });
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
      select: { id: true, name: true, organizerId: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    const updated = await this.prisma.tournament.update({
      where: { id },
      data: { moderationStatus },
    });
    if (moderationStatus === ModerationStatus.HIDDEN_BY_ADMIN) {
      await this.notifications.createNotification({
        userId: tournament.organizerId,
        type: NotificationType.ADMIN_WARNING,
        content: `Tournament "${tournament.name}" was hidden by an administrator. Reason: ${reason!.trim()}`,
        tournamentId: tournament.id,
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
