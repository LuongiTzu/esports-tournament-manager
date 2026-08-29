/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return */
import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import {
  BannedKeywordCategory,
  ModerationStatus,
  Prisma,
  Role,
} from '@prisma/client';
import { ContentFilterService } from '../common/services/content-filter.service';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';
import { AdminController } from './admin.controller';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import {
  AdminDashboardQueryService,
  BannedKeywordService,
} from './admin-operations.services';
import { CommentModerationService } from '../comments/comment-moderation.service';
import { ReportReviewService } from '../reports/report-review.service';
import { TournamentModerationService } from '../tournaments/tournament-moderation.service';
import { UserAdministrationService } from '../users/user-administration.service';
import { NotificationPublisher } from '../common/ports/notification-publisher';

function serviceWith(prisma: object, filter: object = { refresh: jest.fn() }) {
  const client = prisma as PrismaService;
  return new AdminService(
    new AdminDashboardQueryService(client),
    new UserAdministrationService(client),
    new TournamentModerationService(client, {} as NotificationPublisher),
    new ReportReviewService(client),
    new CommentModerationService(client),
    new BannedKeywordService(client, filter as ContentFilterService),
  );
}

describe('AdminService P2 workflows', () => {
  it('keeps all new admin workflows behind JWT and ADMIN role guards', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toEqual([
      JwtAuthGuard,
      EmailVerifiedGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual([
      Role.ADMIN,
    ]);
  });

  it('searches and filters users with stable pagination and a safe projection', async () => {
    const prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([{ id: 'u-1' }]),
        count: jest.fn().mockResolvedValue(1),
      },
    };
    const service = serviceWith(prisma);

    await expect(
      service.listUsers(2, 10, {
        search: 'captain@example.com',
        isLocked: false,
        role: Role.SIGNED_UP_USER,
      }),
    ).resolves.toEqual({
      data: [{ id: 'u-1' }],
      pagination: { page: 2, limit: 10, total: 1, totalPages: 1 },
    });

    const query = prisma.user.findMany.mock.calls[0][0];
    expect(query).toEqual(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({
          isLocked: false,
          role: Role.SIGNED_UP_USER,
          OR: expect.arrayContaining([
            {
              email: {
                contains: 'captain@example.com',
                mode: Prisma.QueryMode.insensitive,
              },
            },
            {
              displayName: {
                contains: 'captain@example.com',
                mode: Prisma.QueryMode.insensitive,
              },
            },
          ]),
        }),
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      }),
    );
    expect(query.select.passwordHash).toBeUndefined();
    expect(query.select.refreshToken).toBeUndefined();
    expect(prisma.user.count).toHaveBeenCalledWith({ where: query.where });

    await service.listUsers(1, 20, { isLocked: true });
    expect(prisma.user.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isLocked: true }),
      }),
    );
  });

  it('provides a hidden-comment review queue with search, hide, unhide and delete', async () => {
    const prisma = {
      comment: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue({
          id: 'c-1',
          parentId: null,
          _count: { replies: 0 },
        }),
        update: jest
          .fn()
          .mockImplementation(({ data }) => ({ id: 'c-1', ...data })),
        delete: jest.fn().mockResolvedValue({ id: 'c-1' }),
      },
    };
    const service = serviceWith(prisma);

    await service.listComments({ isHidden: true, search: 'spam' });
    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          deletedAt: null,
          isHidden: true,
          content: { contains: 'spam', mode: Prisma.QueryMode.insensitive },
        },
        orderBy: [{ isHidden: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      }),
    );
    await expect(service.hideComment('c-1')).resolves.toEqual({
      id: 'c-1',
      isHidden: true,
    });
    await expect(service.unhideComment('c-1')).resolves.toEqual({
      id: 'c-1',
      isHidden: false,
    });
    await expect(service.deleteComment('c-1')).resolves.toEqual({
      message: 'Comment deleted',
      id: 'c-1',
      tombstoned: false,
    });
  });

  it('keeps verification subordinate to moderation', async () => {
    const prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue({
          id: 't-1',
          isVerified: false,
          moderationStatus: ModerationStatus.HIDDEN_BY_ADMIN,
        }),
        update: jest.fn(),
      },
    };
    const service = serviceWith(prisma);

    await expect(service.verifyTournament('t-1', true)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(prisma.tournament.update).not.toHaveBeenCalled();

    prisma.tournament.findUnique.mockResolvedValue({
      id: 't-1',
      isVerified: false,
      moderationStatus: ModerationStatus.ACTIVE,
    });
    prisma.tournament.update.mockResolvedValue({ id: 't-1', isVerified: true });
    await service.verifyTournament('t-1', true);
    expect(prisma.tournament.update).toHaveBeenCalledWith({
      where: { id: 't-1' },
      data: { isVerified: true },
    });
  });

  it('updates a keyword and refreshes the live content-filter cache', async () => {
    let rows = [
      {
        id: 'k-1',
        keyword: 'oldword',
        category: BannedKeywordCategory.PROFANITY,
        createdAt: new Date(),
      },
    ];
    const prisma = {
      bannedKeyword: {
        findMany: jest.fn().mockImplementation(() => rows),
        findUnique: jest
          .fn()
          .mockImplementation(({ where }) =>
            rows.find((row) => row.id === where.id),
          ),
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockImplementation(({ where, data }) => {
          rows = rows.map((row) =>
            row.id === where.id ? { ...row, ...data } : row,
          );
          return rows[0];
        }),
      },
    };
    const filter = new ContentFilterService(prisma as unknown as PrismaService);
    const service = serviceWith(prisma, filter);
    await filter.refresh();

    expect(() => filter.validate('oldword')).toThrow(BadRequestException);
    await service.updateBannedKeyword('k-1', {
      keyword: ' newword ',
      category: BannedKeywordCategory.MALICIOUS_LINK,
    });
    expect(filter.validate('oldword')).toBe('oldword');
    expect(() => filter.validate('newword')).toThrow(BadRequestException);
  });

  it('rejects a case-insensitive duplicate keyword without refreshing', async () => {
    const filter = { refresh: jest.fn() };
    const prisma = {
      bannedKeyword: {
        findUnique: jest.fn().mockResolvedValue({ id: 'k-1' }),
        findFirst: jest.fn().mockResolvedValue({ id: 'k-2' }),
        update: jest.fn(),
      },
    };
    const service = serviceWith(prisma, filter);

    await expect(
      service.updateBannedKeyword('k-1', { keyword: 'Duplicate' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.bannedKeyword.update).not.toHaveBeenCalled();
    expect(filter.refresh).not.toHaveBeenCalled();
  });
});
