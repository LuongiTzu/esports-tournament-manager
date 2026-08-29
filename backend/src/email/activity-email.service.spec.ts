/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { ConfigService } from '@nestjs/config';
import {
  ModerationStatus,
  NotificationType,
  Prisma,
  RegistrationStatus,
  TournamentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityEmailService } from './activity-email.service';
import { EmailService } from './email.service';

function harness() {
  const prisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue({
        email: 'recipient@example.com',
        displayName: 'Recipient',
      }),
    },
    tournament: {
      findUnique: jest.fn().mockResolvedValue({
        name: 'Arena Cup',
        slug: 'arena-cup',
      }),
    },
  } as unknown as PrismaService;
  const email = {
    sendActivity: jest.fn().mockResolvedValue(undefined),
  } as unknown as EmailService;
  const config = {
    get: jest.fn().mockReturnValue('http://localhost:3000'),
  } as unknown as ConfigService;
  return {
    service: new ActivityEmailService(prisma, email, config),
    prisma,
    email,
  };
}

function notification(type: NotificationType, data: Prisma.JsonObject) {
  return {
    kind: 'NOTIFICATION_CREATED' as const,
    notification: {
      userId: 'user-1',
      type,
      data,
      tournamentId: 'tournament-1',
    },
  };
}

describe('ActivityEmailService', () => {
  it('emails the verified account owner after a successful team registration', async () => {
    const { service, email } = harness();

    await service.publish({
      kind: 'TEAM_REGISTRATION_SUCCEEDED',
      userId: 'user-1',
      tournamentId: 'tournament-1',
      teamName: 'Ruby Wolves',
      status: RegistrationStatus.PENDING,
    });

    expect(email.sendActivity).toHaveBeenCalledWith(
      'recipient@example.com',
      expect.objectContaining({
        title: 'Đăng ký đội thành công',
        paragraphs: expect.arrayContaining([
          expect.stringContaining('Ruby Wolves'),
          expect.stringContaining('chờ ban tổ chức'),
        ]),
      }),
    );
  });

  it.each([
    [NotificationType.TEAM_APPROVED, 'Đội đã được duyệt'],
    [NotificationType.TEAM_REJECTED, 'Đăng ký đội bị từ chối'],
  ])('emails a team review decision for %s', async (type, title) => {
    const { service, email } = harness();

    await service.publish(
      notification(type, {
        kind: 'TEAM_REVIEW',
        teamName: 'Ruby Wolves',
        rejectReason: 'Roster chưa hợp lệ',
      }),
    );

    expect(email.sendActivity).toHaveBeenCalledWith(
      'recipient@example.com',
      expect.objectContaining({ title }),
    );
  });

  it('emails both the old and new match schedule', async () => {
    const { service, email } = harness();

    await service.publish(
      notification(NotificationType.SCHEDULE_CHANGE, {
        kind: 'MATCH_SCHEDULE',
        matchNumber: 3,
        teamAName: 'Ruby Wolves',
        teamBName: 'Blue Foxes',
        oldScheduledAt: '2026-08-30T01:00:00.000Z',
        newScheduledAt: '2026-08-30T03:00:00.000Z',
      }),
    );

    expect(email.sendActivity).toHaveBeenCalledWith(
      'recipient@example.com',
      expect.objectContaining({
        title: 'Lịch thi đấu đã thay đổi',
        paragraphs: expect.arrayContaining([
          expect.stringContaining('Lịch cũ'),
        ]),
        action: expect.objectContaining({
          url: 'http://localhost:3000/tournaments/arena-cup#competition',
        }),
      }),
    );
  });

  it('emails the updated match score', async () => {
    const { service, email } = harness();

    await service.publish(
      notification(NotificationType.SCORE_UPDATE, {
        kind: 'MATCH_RESULT',
        teamAName: 'Ruby Wolves',
        teamBName: 'Blue Foxes',
        scoreA: 2,
        scoreB: 1,
      }),
    );

    expect(email.sendActivity).toHaveBeenCalledWith(
      'recipient@example.com',
      expect.objectContaining({
        title: 'Kết quả trận đấu đã được cập nhật',
        paragraphs: expect.arrayContaining([expect.stringContaining('2 - 1')]),
        action: expect.objectContaining({
          url: 'http://localhost:3000/tournaments/arena-cup#competition',
        }),
      }),
    );
  });

  it('emails a tournament lifecycle status transition', async () => {
    const { service, email } = harness();

    await service.publish(
      notification(NotificationType.TOURNAMENT_STATUS, {
        kind: 'TOURNAMENT_STATUS',
        previousStatus: TournamentStatus.REGISTRATION,
        status: TournamentStatus.ONGOING,
      }),
    );

    expect(email.sendActivity).toHaveBeenCalledWith(
      'recipient@example.com',
      expect.objectContaining({
        title: 'Trạng thái giải đấu đã thay đổi',
        paragraphs: expect.arrayContaining([
          expect.stringContaining('Đang đăng ký → Đang thi đấu'),
        ]),
      }),
    );
  });

  it.each([
    [ModerationStatus.HIDDEN_BY_ADMIN, 'Giải đấu đã bị ẩn'],
    [ModerationStatus.ACTIVE, 'Giải đấu đã được khôi phục'],
  ])(
    'emails the organizer when moderation changes to %s',
    async (status, title) => {
      const { service, email } = harness();

      await service.publish(
        notification(NotificationType.ADMIN_WARNING, {
          kind: 'TOURNAMENT_MODERATION',
          moderationStatus: status,
          ...(status === ModerationStatus.HIDDEN_BY_ADMIN
            ? { reason: 'Vi phạm' }
            : {}),
        }),
      );

      expect(email.sendActivity).toHaveBeenCalledWith(
        'recipient@example.com',
        expect.objectContaining({ title }),
      );
    },
  );

  it('emails the target user when a comment receives a reply', async () => {
    const { service, email } = harness();

    await service.publish(
      notification(NotificationType.COMMENT_REPLY, {
        kind: 'COMMENT_REPLY',
        replierName: 'Player Two',
        replyPreview: 'Chúc đội bạn thi đấu tốt!',
        rootCommentId: 'comment-1',
      }),
    );

    expect(email.sendActivity).toHaveBeenCalledWith(
      'recipient@example.com',
      expect.objectContaining({
        title: 'Có người trả lời bình luận của bạn',
        action: expect.objectContaining({
          url: 'http://localhost:3000/tournaments/arena-cup#comment-comment-1',
        }),
      }),
    );
  });

  it.each([
    [true, 'Tài khoản đã bị khóa'],
    [false, 'Tài khoản đã được mở khóa'],
  ])('emails an account lock transition to %s', async (isLocked, title) => {
    const { service, email } = harness();

    await service.publish({
      kind: 'ACCOUNT_LOCK_CHANGED',
      userId: 'user-1',
      isLocked,
    });

    expect(email.sendActivity).toHaveBeenCalledWith(
      'recipient@example.com',
      expect.objectContaining({ title }),
    );
  });

  it('ignores unrelated in-app notification types', async () => {
    const { service, email, prisma } = harness();

    await service.publish(notification(NotificationType.SYSTEM, {}));

    expect(email.sendActivity).not.toHaveBeenCalled();
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('does not send activity email to fictional seed domains', async () => {
    const { service, email, prisma } = harness();
    jest.mocked(prisma.user.findUnique).mockResolvedValue({
      email: 'nguyen.tuan.kiet@seed.esports.test',
      displayName: 'Nguyễn Tuấn Kiệt',
    } as never);

    await service.publish({
      kind: 'ACCOUNT_LOCK_CHANGED',
      userId: 'seed-user-participant-01',
      isLocked: true,
    });

    expect(email.sendActivity).not.toHaveBeenCalled();
  });

  it('swallows SMTP failures so the completed business action is preserved', async () => {
    const { service, email } = harness();
    jest.mocked(email.sendActivity).mockRejectedValue(new Error('smtp failed'));

    await expect(
      service.publish({
        kind: 'ACCOUNT_LOCK_CHANGED',
        userId: 'user-1',
        isLocked: true,
      }),
    ).resolves.toBeUndefined();
  });
});
