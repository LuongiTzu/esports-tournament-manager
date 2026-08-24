import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CommentModerationService {
  constructor(private readonly prisma: PrismaService) {}
  list(query: { isHidden?: boolean; search?: string } = {}) {
    const search = query.search?.trim();
    return this.prisma.comment.findMany({
      where: {
        isHidden: query.isHidden,
        ...(search
          ? {
              content: { contains: search, mode: Prisma.QueryMode.insensitive },
            }
          : {}),
      },
      orderBy: [{ isHidden: 'desc' }, { createdAt: 'desc' }, { id: 'asc' }],
      include: {
        author: { select: { id: true, displayName: true } },
        tournament: { select: { id: true, name: true, slug: true } },
      },
    });
  }
  hide(id: string) {
    return this.setHidden(id, true);
  }
  unhide(id: string) {
    return this.setHidden(id, false);
  }
  async remove(id: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    await this.prisma.comment.delete({ where: { id } });
    return { message: 'Comment deleted', id };
  }
  private async setHidden(id: string, isHidden: boolean) {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return this.prisma.comment.update({ where: { id }, data: { isHidden } });
  }
}
