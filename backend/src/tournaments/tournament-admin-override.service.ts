import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  NotificationType,
  Prisma,
  TournamentAdminOverrideStatus,
} from '@prisma/client';
import {
  NOTIFICATION_PUBLISHER,
  NotificationPublisher,
} from '../common/ports/notification-publisher';
import {
  ACTIVE_ADMIN_OVERRIDE_SELECT,
  TournamentManagementAccessService,
} from '../common/services/tournament-management-access.service';
import { PrismaService } from '../prisma/prisma.service';

const ADMIN_OVERRIDE_DURATION_MS = 4 * 60 * 60 * 1000;

@Injectable()
export class TournamentAdminOverrideService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly access: TournamentManagementAccessService,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notifications: NotificationPublisher,
  ) {}

  getActive(tournamentId: string) {
    return this.access.findActiveOverride(tournamentId);
  }

  async start(
    tournamentId: string,
    admin: { id: string; email: string },
    rawReason: string,
  ) {
    const reason = rawReason.trim();
    if (reason.length < 10 || reason.length > 500) {
      throw new BadRequestException(
        'Admin Override reason must contain between 10 and 500 characters',
      );
    }
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, organizerId: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    if (tournament.organizerId === admin.id) {
      throw new BadRequestException(
        'The tournament organizer does not need an Admin Override session',
      );
    }

    const now = new Date();
    await this.prisma.tournamentAdminOverride.updateMany({
      where: {
        tournamentId,
        status: TournamentAdminOverrideStatus.ACTIVE,
        expiresAt: { lte: now },
      },
      data: {
        status: TournamentAdminOverrideStatus.ENDED,
        endedAt: now,
      },
    });
    const existing = await this.access.findActiveOverride(tournamentId);
    if (existing) {
      throw new ConflictException(
        'This tournament already has an active Admin Override session',
      );
    }

    let override;
    try {
      override = await this.prisma.tournamentAdminOverride.create({
        data: {
          tournamentId,
          adminId: admin.id,
          reason,
          expiresAt: new Date(now.getTime() + ADMIN_OVERRIDE_DURATION_MS),
        },
        select: ACTIVE_ADMIN_OVERRIDE_SELECT,
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'This tournament already has an active Admin Override session',
        );
      }
      throw error;
    }

    await this.notifyOrganizer({
      organizerId: tournament.organizerId,
      tournamentId,
      overrideId: override.id,
      status: TournamentAdminOverrideStatus.ACTIVE,
      reason,
      adminEmail: admin.email,
    });
    return override;
  }

  async end(tournamentId: string, admin: { id: string; email: string }) {
    const [tournament, active] = await Promise.all([
      this.prisma.tournament.findUnique({
        where: { id: tournamentId },
        select: { id: true, organizerId: true },
      }),
      this.access.findActiveOverride(tournamentId),
    ]);
    if (!tournament) throw new NotFoundException('Tournament not found');
    if (!active) {
      throw new NotFoundException(
        'This tournament does not have an active Admin Override session',
      );
    }
    if (active.adminId !== admin.id) {
      throw new ForbiddenException(
        'Only the Admin who started this override session can end it',
      );
    }

    const ended = await this.prisma.tournamentAdminOverride.update({
      where: { id: active.id },
      data: {
        status: TournamentAdminOverrideStatus.ENDED,
        endedAt: new Date(),
      },
      select: ACTIVE_ADMIN_OVERRIDE_SELECT,
    });
    await this.notifyOrganizer({
      organizerId: tournament.organizerId,
      tournamentId,
      overrideId: ended.id,
      status: TournamentAdminOverrideStatus.ENDED,
      reason: ended.reason,
      adminEmail: admin.email,
    });
    return ended;
  }

  private notifyOrganizer(input: {
    organizerId: string;
    tournamentId: string;
    overrideId: string;
    status: TournamentAdminOverrideStatus;
    reason: string;
    adminEmail: string;
  }) {
    return this.notifications.createNotification({
      userId: input.organizerId,
      type: NotificationType.ADMIN_WARNING,
      content:
        input.status === TournamentAdminOverrideStatus.ACTIVE
          ? 'An administrator started an override session for your tournament'
          : 'The administrator override session for your tournament ended',
      data: {
        kind: 'TOURNAMENT_ADMIN_OVERRIDE',
        overrideStatus: input.status,
        reason: input.reason,
        adminEmail: input.adminEmail,
      },
      tournamentId: input.tournamentId,
      sourceKey: `tournament:${input.tournamentId}:admin-override:${input.overrideId}:${input.status}`,
    });
  }
}
