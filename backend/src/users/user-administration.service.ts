import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  ACTIVITY_EMAIL_PUBLISHER,
  ActivityEmailPublisher,
  NOOP_ACTIVITY_EMAIL_PUBLISHER,
} from '../common/ports/activity-email-publisher';

@Injectable()
export class UserAdministrationService {
  private readonly logger = new Logger(UserAdministrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ACTIVITY_EMAIL_PUBLISHER)
    private readonly activityEmails: ActivityEmailPublisher = NOOP_ACTIVITY_EMAIL_PUBLISHER,
  ) {}

  async listUsers(
    page = 1,
    limit = 20,
    filters: { search?: string; isLocked?: boolean; role?: Role } = {},
  ) {
    const skip = (page - 1) * limit;
    const search = filters.search?.trim();
    const where: Prisma.UserWhereInput = {
      isLocked: filters.isLocked,
      role: filters.role,
      ...(search
        ? {
            OR: [
              {
                email: { contains: search, mode: Prisma.QueryMode.insensitive },
              },
              {
                displayName: {
                  contains: search,
                  mode: Prisma.QueryMode.insensitive,
                },
              },
            ],
          }
        : {}),
    };
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take: limit,
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
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
      this.prisma.user.count({ where }),
    ]);
    return {
      data: users,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async setUserLockStatus(
    actorAdminId: string,
    userId: string,
    isLocked: boolean,
  ) {
    if (actorAdminId === userId)
      throw new BadRequestException('Không thể khóa tài khoản của chính mình');
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException('Không tìm thấy người dùng');
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { isLocked, ...(isLocked && { tokenVersion: { increment: 1 } }) },
      select: {
        id: true,
        email: true,
        displayName: true,
        role: true,
        isLocked: true,
        updatedAt: true,
      },
    });
    if (user.isLocked !== isLocked) {
      void this.activityEmails
        .publish({ kind: 'ACCOUNT_LOCK_CHANGED', userId, isLocked })
        .catch((error: unknown) => {
          this.logger.error(
            `Account ${userId} lock state changed but email publishing failed`,
            error instanceof Error ? error.stack : String(error),
          );
        });
    }
    return updated;
  }
}
