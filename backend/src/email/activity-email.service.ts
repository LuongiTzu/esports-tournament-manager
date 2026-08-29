import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ModerationStatus,
  NotificationType,
  RegistrationStatus,
  TournamentStatus,
} from '@prisma/client';
import {
  ActivityEmailEvent,
  ActivityEmailPublisher,
} from '../common/ports/activity-email-publisher';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';

interface EmailContent {
  title: string;
  paragraphs: string[];
  action?: { label: string; path: string };
}

@Injectable()
export class ActivityEmailService implements ActivityEmailPublisher {
  private readonly logger = new Logger(ActivityEmailService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async publish(event: ActivityEmailEvent): Promise<void> {
    try {
      if (event.kind === 'TEAM_REGISTRATION_SUCCEEDED') {
        await this.sendTeamRegistration(event);
        return;
      }
      if (event.kind === 'ACCOUNT_LOCK_CHANGED') {
        await this.sendAccountLockChanged(event.userId, event.isLocked);
        return;
      }
      await this.sendNotification(event.notification);
    } catch (error) {
      this.logger.error(
        `Activity email delivery failed for ${event.kind}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private async sendTeamRegistration(
    event: Extract<ActivityEmailEvent, { kind: 'TEAM_REGISTRATION_SUCCEEDED' }>,
  ) {
    const [user, tournament] = await Promise.all([
      this.findUser(event.userId),
      this.findTournament(event.tournamentId),
    ]);
    if (!user || !tournament || isSeedEmail(user.email)) return;
    const statusLabel =
      event.status === RegistrationStatus.APPROVED
        ? 'Đội đã được duyệt tự động và có thể tham gia giải.'
        : 'Đăng ký đang chờ ban tổ chức xét duyệt.';
    await this.email.sendActivity(user.email, {
      displayName: user.displayName,
      title: 'Đăng ký đội thành công',
      paragraphs: [
        `Đội ${event.teamName} đã đăng ký thành công vào giải ${tournament.name}.`,
        statusLabel,
      ],
      action: {
        label: 'Xem giải đấu',
        url: this.tournamentUrl(tournament.slug),
      },
    });
  }

  private async sendAccountLockChanged(userId: string, isLocked: boolean) {
    const user = await this.findUser(userId);
    if (!user || isSeedEmail(user.email)) return;
    await this.email.sendActivity(user.email, {
      displayName: user.displayName,
      title: isLocked ? 'Tài khoản đã bị khóa' : 'Tài khoản đã được mở khóa',
      paragraphs: [
        isLocked
          ? 'Quản trị viên đã khóa tài khoản ArenaVerse của bạn. Các phiên đăng nhập hiện tại đã bị vô hiệu hóa.'
          : 'Quản trị viên đã mở khóa tài khoản ArenaVerse của bạn. Bạn có thể đăng nhập và tiếp tục sử dụng hệ thống.',
        'Nếu bạn cho rằng đây là nhầm lẫn, vui lòng liên hệ quản trị viên để được hỗ trợ.',
      ],
      action: isLocked
        ? undefined
        : { label: 'Đăng nhập', url: this.frontendUrl('/login') },
    });
  }

  private async sendNotification(
    notification: Extract<
      ActivityEmailEvent,
      { kind: 'NOTIFICATION_CREATED' }
    >['notification'],
  ) {
    const data = asRecord(notification.data);
    const content = this.notificationContent(notification.type, data);
    if (!content) return;
    const [user, tournament] = await Promise.all([
      this.findUser(notification.userId),
      notification.tournamentId
        ? this.findTournament(notification.tournamentId)
        : Promise.resolve(null),
    ]);
    if (!user || isSeedEmail(user.email)) return;
    const action = content.action
      ? {
          label: content.action.label,
          url: tournament
            ? this.tournamentUrl(tournament.slug, content.action.path)
            : this.frontendUrl(content.action.path),
        }
      : undefined;
    await this.email.sendActivity(user.email, {
      displayName: user.displayName,
      title: content.title,
      paragraphs: content.paragraphs.map((paragraph) =>
        paragraph.replaceAll('{tournament}', tournament?.name ?? 'giải đấu'),
      ),
      action,
    });
  }

  private notificationContent(
    type: NotificationType,
    data: Record<string, unknown>,
  ): EmailContent | null {
    switch (type) {
      case NotificationType.TEAM_APPROVED:
        return {
          title: 'Đội đã được duyệt',
          paragraphs: [
            `Đội ${stringValue(data.teamName, 'của bạn')} đã được chấp nhận tham gia {tournament}.`,
            'Hãy theo dõi lịch thi đấu và các thông báo tiếp theo từ ban tổ chức.',
          ],
          action: { label: 'Xem giải đấu', path: '' },
        };
      case NotificationType.TEAM_REJECTED:
        return {
          title: 'Đăng ký đội bị từ chối',
          paragraphs: [
            `Đội ${stringValue(data.teamName, 'của bạn')} chưa được chấp nhận tham gia {tournament}.`,
            data.rejectReason
              ? `Lý do: ${stringValue(data.rejectReason, '')}`
              : 'Vui lòng liên hệ ban tổ chức nếu bạn cần thêm thông tin.',
          ],
          action: { label: 'Xem giải đấu', path: '' },
        };
      case NotificationType.SCHEDULE_CHANGE:
        return this.matchScheduleContent(data);
      case NotificationType.SCORE_UPDATE:
        return this.matchResultContent(data);
      case NotificationType.TOURNAMENT_STATUS:
        return {
          title: 'Trạng thái giải đấu đã thay đổi',
          paragraphs: [
            '{tournament} vừa được cập nhật trạng thái.',
            `${tournamentStatusLabel(data.previousStatus)} → ${tournamentStatusLabel(data.status)}`,
          ],
          action: { label: 'Xem giải đấu', path: '' },
        };
      case NotificationType.COMMENT_REPLY:
        return {
          title: 'Có người trả lời bình luận của bạn',
          paragraphs: [
            `${stringValue(data.replierName, 'Một người dùng')} đã trả lời bình luận của bạn tại {tournament}.`,
            `“${stringValue(data.replyPreview, '')}”`,
          ],
          action: {
            label: 'Xem trả lời',
            path: `#comment-${stringValue(data.rootCommentId, '')}`,
          },
        };
      case NotificationType.ADMIN_WARNING:
        if (data.kind !== 'TOURNAMENT_MODERATION') return null;
        return {
          title:
            data.moderationStatus === ModerationStatus.HIDDEN_BY_ADMIN
              ? 'Giải đấu đã bị ẩn'
              : 'Giải đấu đã được khôi phục',
          paragraphs: [
            `Trạng thái kiểm duyệt của {tournament} đã chuyển thành ${moderationStatusLabel(data.moderationStatus)}.`,
            data.reason
              ? `Lý do: ${stringValue(data.reason, '')}`
              : 'Thay đổi được thực hiện bởi quản trị viên ArenaVerse.',
          ],
          action: { label: 'Xem giải đấu', path: '' },
        };
      default:
        return null;
    }
  }

  private matchScheduleContent(data: Record<string, unknown>): EmailContent {
    return {
      title: 'Lịch thi đấu đã thay đổi',
      paragraphs: [
        `${matchLabel(data)} tại {tournament} vừa được cập nhật lịch.`,
        `Lịch cũ: ${dateTimeLabel(data.oldScheduledAt)}. Lịch mới: ${dateTimeLabel(data.newScheduledAt)}.`,
      ],
      action: { label: 'Xem lịch thi đấu', path: '#competition' },
    };
  }

  private matchResultContent(data: Record<string, unknown>): EmailContent {
    return {
      title: 'Kết quả trận đấu đã được cập nhật',
      paragraphs: [
        `${matchLabel(data)} tại {tournament} vừa có kết quả mới.`,
        `${stringValue(data.teamAName, 'Đội A')} ${numberValue(data.scoreA)} - ${numberValue(data.scoreB)} ${stringValue(data.teamBName, 'Đội B')}`,
      ],
      action: { label: 'Xem kết quả', path: '#competition' },
    };
  }

  private findUser(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: { email: true, displayName: true },
    });
  }

  private findTournament(id: string) {
    return this.prisma.tournament.findUnique({
      where: { id },
      select: { name: true, slug: true },
    });
  }

  private tournamentUrl(slug: string, suffix = '') {
    return this.frontendUrl(
      `/tournaments/${encodeURIComponent(slug)}${suffix}`,
    );
  }

  private frontendUrl(path: string) {
    const base = this.config
      .get<string>('FRONTEND_URL', 'http://localhost:3000')
      .replace(/\/$/, '');
    return `${base}${path}`;
  }
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function stringValue(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function matchLabel(data: Record<string, unknown>): string {
  const number = numberValue(data.matchNumber);
  const teams = `${stringValue(data.teamAName, 'Đội A')} vs ${stringValue(data.teamBName, 'Đội B')}`;
  return number > 0 ? `Trận #${number} (${teams})` : `Trận ${teams}`;
}

function dateTimeLabel(value: unknown): string {
  if (value === null || value === undefined || value === '')
    return 'chưa xếp lịch';
  if (typeof value !== 'string') return 'không xác định';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'không xác định';
  return new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Ho_Chi_Minh',
  }).format(date);
}

function tournamentStatusLabel(value: unknown): string {
  const labels: Partial<Record<TournamentStatus, string>> = {
    [TournamentStatus.DRAFT]: 'Bản nháp',
    [TournamentStatus.REGISTRATION]: 'Đang đăng ký',
    [TournamentStatus.ONGOING]: 'Đang thi đấu',
    [TournamentStatus.COMPLETED]: 'Đã kết thúc',
    [TournamentStatus.CANCELLED]: 'Đã hủy',
  };
  return typeof value === 'string' && value in labels
    ? labels[value as TournamentStatus]!
    : 'Không xác định';
}

function moderationStatusLabel(value: unknown): string {
  return value === ModerationStatus.HIDDEN_BY_ADMIN
    ? 'Đã bị ẩn bởi quản trị viên'
    : 'Đang hoạt động';
}

function isSeedEmail(email: string): boolean {
  return email.toLowerCase().endsWith('.test');
}
