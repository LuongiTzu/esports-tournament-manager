import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NotificationType, Prisma, ReportStatus, Role } from '@prisma/client';
import {
  NOTIFICATION_PUBLISHER,
  NotificationPublisher,
} from '../common/ports/notification-publisher';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

@Injectable()
export class ReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notifications: NotificationPublisher,
  ) {}

  async create(slug: string, dto: CreateReportDto, reporterUserId?: string) {
    const threshold = Math.max(
      1,
      this.config.get<number>('REPORT_PENDING_THRESHOLD', 3),
    );
    const result = await this.prisma.$transaction(
      async (tx) => {
        const tournament = await tx.tournament.findUnique({
          where: { slug },
          select: { id: true, name: true },
        });
        if (!tournament) throw new NotFoundException('Tournament not found');

        if (reporterUserId) {
          const duplicate = await tx.report.findFirst({
            where: {
              tournamentId: tournament.id,
              reporterUserId,
              status: ReportStatus.PENDING,
            },
            select: { id: true },
          });
          if (duplicate) {
            throw new ConflictException(
              'You already have an active report for this tournament',
            );
          }
        }

        const report = await tx.report.create({
          data: {
            tournamentId: tournament.id,
            reporterUserId: reporterUserId ?? null,
            reason: dto.reason,
            description: dto.description?.trim(),
          },
          select: {
            id: true,
            tournamentId: true,
            reason: true,
            description: true,
            status: true,
            createdAt: true,
          },
        });
        const pendingCount = await tx.report.count({
          where: {
            tournamentId: tournament.id,
            status: ReportStatus.PENDING,
          },
        });
        const adminNotifications: Array<Prisma.NotificationGetPayload<object>> =
          [];
        if (pendingCount === threshold) {
          const content = `Tournament "${tournament.name}" reached ${threshold} pending reports`;
          const existingThresholdNotification = await tx.notification.findFirst(
            {
              where: {
                tournamentId: tournament.id,
                type: NotificationType.SYSTEM,
                content,
              },
              select: { id: true },
            },
          );
          if (!existingThresholdNotification) {
            const admins = await tx.user.findMany({
              where: { role: Role.ADMIN, isLocked: false },
              select: { id: true },
            });
            for (const admin of admins) {
              adminNotifications.push(
                await this.notifications.createNotification(
                  {
                    userId: admin.id,
                    type: NotificationType.SYSTEM,
                    content,
                    tournamentId: tournament.id,
                  },
                  tx,
                  false,
                ),
              );
            }
          }
        }
        return { report, pendingCount, adminNotifications };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
    result.adminNotifications.forEach((notification) =>
      this.notifications.emitCreated(notification),
    );
    return { ...result.report, pendingReportCount: result.pendingCount };
  }
}
