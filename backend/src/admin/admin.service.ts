import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import { CreateBannedKeywordDto } from './dto/banned-keyword.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    private readonly contentFilter: ContentFilterService,
  ) {}

  listBannedKeywords() {
    return this.prisma.bannedKeyword.findMany({
      orderBy: [{ category: 'asc' }, { keyword: 'asc' }],
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
