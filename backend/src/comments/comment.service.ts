import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentEventsService } from '../tournaments/tournament-events.service';
import { ContentFilterService } from '../common/services/content-filter.service';

const AUTHOR_SELECT = {
  id: true,
  displayName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filter: ContentFilterService,
    private readonly events: TournamentEventsService,
  ) {}

  async create(slug: string, authorId: string, rawContent: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    const content = this.filter.validate(rawContent);
    const comment = await this.prisma.comment.create({
      data: { content, authorId, tournamentId: tournament.id },
      include: { author: { select: AUTHOR_SELECT } },
    });
    this.events.publish({
      tournamentId: tournament.id,
      event: 'newComment',
      payload: comment,
    });
    return comment;
  }

  async findByTournament(
    slug: string,
    viewer?: { id: string; role: string },
    query: { page?: number; limit?: number } = {},
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      select: { id: true, organizerId: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    const canModerate =
      viewer?.role === Role.ADMIN || viewer?.id === tournament.organizerId;
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const where = {
      tournamentId: tournament.id,
      isHidden: canModerate ? undefined : false,
    };
    const [data, total] = await Promise.all([
      this.prisma.comment.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { author: { select: AUTHOR_SELECT } },
      }),
      this.prisma.comment.count({ where }),
    ]);
    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async hide(commentId: string, user: { id: string; role: string }) {
    const comment = await this.findAccessRecord(commentId);
    if (
      user.role !== Role.ADMIN &&
      user.id !== comment.tournament.organizerId
    ) {
      throw new ForbiddenException('Only organizer or admin may hide comments');
    }
    return this.prisma.comment.update({
      where: { id: commentId },
      data: { isHidden: true },
      include: { author: { select: AUTHOR_SELECT } },
    });
  }

  async remove(commentId: string, user: { id: string; role: string }) {
    const comment = await this.findAccessRecord(commentId);
    const allowed =
      user.role === Role.ADMIN ||
      user.id === comment.authorId ||
      user.id === comment.tournament.organizerId;
    if (!allowed) throw new ForbiddenException('Comment deletion denied');
    await this.prisma.comment.delete({ where: { id: commentId } });
    return { message: 'Comment deleted', commentId };
  }

  private async findAccessRecord(commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        authorId: true,
        tournament: { select: { organizerId: true } },
      },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }
}
