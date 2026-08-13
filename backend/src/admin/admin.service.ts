import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ModerationStatus,
  NotificationType,
  ReportStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import { CreateBannedKeywordDto } from './dto/banned-keyword.dto';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private readonly contentFilter: ContentFilterService,
    private readonly notifications: NotificationService,
  ) {}

  listBannedKeywords() {
    return this.prisma.bannedKeyword.findMany({
      orderBy: [{ category: 'asc' }, { keyword: 'asc' }],
    });
  }

  async listTournaments(moderationStatus?: ModerationStatus) {
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

  async moderateTournament(
    id: string,
    moderationStatus: ModerationStatus,
    reason?: string,
  ) {
    if (
      moderationStatus === ModerationStatus.HIDDEN_BY_ADMIN &&
      !reason?.trim()
    ) {
      throw new BadRequestException(
        'Reason is required when hiding tournament',
      );
    }
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

  listReports(status?: ReportStatus) {
    return this.prisma.report.findMany({
      where: { status },
      orderBy: { createdAt: 'desc' },
      include: {
        tournament: { select: { id: true, name: true, slug: true } },
        reporter: { select: { id: true, displayName: true } },
        reviewer: { select: { id: true, displayName: true } },
      },
    });
  }

  async reviewReport(id: string, status: ReportStatus, adminId: string) {
    if (status === ReportStatus.PENDING) {
      throw new BadRequestException('Report can only be REVIEWED or DISMISSED');
    }
    const report = await this.prisma.report.findUnique({
      where: { id },
      select: { id: true, status: true },
    });
    if (!report) throw new NotFoundException('Report not found');
    if (report.status !== ReportStatus.PENDING) {
      throw new BadRequestException('Only PENDING reports may be reviewed');
    }
    return this.prisma.report.update({
      where: { id },
      data: { status, reviewedAt: new Date(), reviewedBy: adminId },
    });
  }

  listComments(isHidden?: boolean) {
    return this.prisma.comment.findMany({
      where: { isHidden },
      orderBy: { createdAt: 'desc' },
      include: {
        author: { select: { id: true, displayName: true } },
        tournament: { select: { id: true, name: true, slug: true } },
      },
    });
  }

  async hideComment(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return this.prisma.comment.update({
      where: { id },
      data: { isHidden: true },
    });
  }

  async stats() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const [
      totalTournaments,
      totalUsers,
      reportedTournamentRows,
      lockedTournaments,
      lockedAccounts,
      tournamentsLast7Days,
    ] = await Promise.all([
      this.prisma.tournament.count(),
      this.prisma.user.count(),
      this.prisma.report.groupBy({
        by: ['tournamentId'],
        where: { status: ReportStatus.PENDING },
      }),
      this.prisma.tournament.count({
        where: { moderationStatus: ModerationStatus.HIDDEN_BY_ADMIN },
      }),
      this.prisma.user.count({ where: { isLocked: true } }),
      this.prisma.tournament.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
    ]);
    return {
      totalTournaments,
      totalUsers,
      tournamentsBeingReported: reportedTournamentRows.length,
      lockedTournaments,
      lockedAccounts,
      tournamentsCreatedLast7Days: tournamentsLast7Days,
    };
  }

  async verifyTournament(id: string, explicit?: boolean) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      select: { id: true, isVerified: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    return this.prisma.tournament.update({
      where: { id },
      data: { isVerified: explicit ?? !tournament.isVerified },
    });
  }

  async createBannedKeyword(dto: CreateBannedKeywordDto) {
    const result = await this.prisma.bannedKeyword.create({
      data: { keyword: dto.keyword.trim(), category: dto.category },
    });
    await this.contentFilter.refresh();
    return result;
  }

  async deleteBannedKeyword(id: string) {
    const keyword = await this.prisma.bannedKeyword.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!keyword) throw new NotFoundException('Banned keyword not found');
    await this.prisma.bannedKeyword.delete({ where: { id } });
    await this.contentFilter.refresh();
    return { message: 'Banned keyword deleted', id };
  }

  /** Lấy danh sách tất cả người dùng (phân trang) */
  async listUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          displayName: true,
          avatarUrl: true,
          role: true,
          isLocked: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count(),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /** Khóa / mở khóa tài khoản người dùng */
  async setUserLockStatus(userId: string, isLocked: boolean) {
    // Không cho phép tự khóa chính mình
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isLocked,
        // Khi khóa tài khoản, vô hiệu toàn bộ token của user đó
        ...(isLocked && { tokenVersion: { increment: 1 } }),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isLocked: true,
        updatedAt: true,
      },
    });

    return updated;
  }
}
