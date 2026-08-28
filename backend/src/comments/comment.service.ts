import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  TOURNAMENT_EVENT_PUBLISHER,
  TournamentEventPublisher,
} from '../common/ports/tournament-event-publisher';
import {
  NOTIFICATION_PUBLISHER,
  NotificationPublisher,
} from '../common/ports/notification-publisher';
import { ContentFilterService } from '../common/services/content-filter.service';

const PUBLIC_USER_SELECT = {
  id: true,
  displayName: true,
  avatarUrl: true,
} as const;

const COMMENT_RELATIONS = {
  author: { select: PUBLIC_USER_SELECT },
  replyToUser: { select: PUBLIC_USER_SELECT },
} as const;

type CommentReadRecord = Prisma.CommentGetPayload<{
  include: typeof COMMENT_RELATIONS;
}>;

type RootCommentReadRecord = Prisma.CommentGetPayload<{
  include: typeof COMMENT_RELATIONS & {
    replies: { include: typeof COMMENT_RELATIONS };
  };
}>;

@Injectable()
export class CommentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filter: ContentFilterService,
    @Inject(TOURNAMENT_EVENT_PUBLISHER)
    private readonly events: TournamentEventPublisher,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notifications: NotificationPublisher,
  ) {}

  async create(
    slug: string,
    authorId: string,
    rawContent: string,
    replyToCommentId?: string,
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      select: { id: true, name: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    const content = this.filter.validate(rawContent);

    const result = await this.prisma.$transaction(async (tx) => {
      const target = replyToCommentId
        ? await tx.comment.findUnique({
            where: { id: replyToCommentId },
            select: {
              id: true,
              authorId: true,
              tournamentId: true,
              parentId: true,
              isHidden: true,
              deletedAt: true,
              author: { select: PUBLIC_USER_SELECT },
              parent: {
                select: {
                  id: true,
                  parentId: true,
                  tournamentId: true,
                  isHidden: true,
                  deletedAt: true,
                },
              },
            },
          })
        : null;

      if (replyToCommentId && !target) {
        throw new NotFoundException('Reply target not found');
      }
      if (target && target.tournamentId !== tournament.id) {
        throw new BadRequestException(
          'Reply target must belong to the same tournament',
        );
      }
      if (target && (target.isHidden || target.deletedAt)) {
        throw new BadRequestException('Reply target is not available');
      }
      if (target?.parentId && !target.parent) {
        throw new BadRequestException('Reply thread is not available');
      }

      const root = target?.parentId ? target.parent : target;
      if (
        root &&
        (root.parentId !== null ||
          root.tournamentId !== tournament.id ||
          root.isHidden ||
          root.deletedAt)
      ) {
        throw new BadRequestException('Reply thread is not available');
      }

      const comment = await tx.comment.create({
        data: {
          content,
          authorId,
          tournamentId: tournament.id,
          parentId: root?.id,
          replyToUserId: target?.authorId,
        },
        include: COMMENT_RELATIONS,
      });

      const notification =
        target && target.authorId !== authorId
          ? await this.notifications.createNotification(
              {
                userId: target.authorId,
                type: NotificationType.COMMENT_REPLY,
                content: `${comment.author.displayName} replied to your comment: "${replyPreview(content)}"`,
                data: {
                  kind: 'COMMENT_REPLY',
                  tournamentId: tournament.id,
                  tournamentName: tournament.name,
                  rootCommentId: root!.id,
                  replyCommentId: comment.id,
                  replierId: authorId,
                  replierName: comment.author.displayName,
                  replyPreview: replyPreview(content),
                },
                tournamentId: tournament.id,
                sourceKey: `comment-reply:${comment.id}`,
              },
              tx,
              false,
            )
          : null;

      return { comment, notification };
    });

    if (result.notification) {
      this.notifications.emitCreated(result.notification);
    }
    const response = toCommentReadModel(result.comment);
    this.events.publish({
      tournamentId: tournament.id,
      event: 'newComment',
      payload: response,
    });
    return response;
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
    const page = query.page ?? 1;
    const limit = Math.min(50, query.limit ?? 20);
    const visibleReplyWhere: Prisma.CommentWhereInput = {
      isHidden: canModerate ? undefined : false,
    };
    const rootWhere: Prisma.CommentWhereInput = {
      tournamentId: tournament.id,
      parentId: null,
      isHidden: canModerate ? undefined : false,
      ...(canModerate
        ? {}
        : {
            OR: [
              { deletedAt: null },
              { replies: { some: { isHidden: false } } },
            ],
          }),
    };
    const discussionWhere: Prisma.CommentWhereInput = {
      tournamentId: tournament.id,
      isHidden: canModerate ? undefined : false,
      ...(canModerate
        ? {}
        : {
            OR: [
              {
                parentId: null,
                OR: [
                  { deletedAt: null },
                  { replies: { some: { isHidden: false } } },
                ],
              },
              { parentId: { not: null }, parent: { isHidden: false } },
            ],
          }),
    };

    const [records, total, discussionTotal] = await Promise.all([
      this.prisma.comment.findMany({
        where: rootWhere,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        include: {
          ...COMMENT_RELATIONS,
          replies: {
            where: visibleReplyWhere,
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            include: COMMENT_RELATIONS,
          },
        },
      }),
      this.prisma.comment.count({ where: rootWhere }),
      this.prisma.comment.count({ where: discussionWhere }),
    ]);

    return {
      data: records.map(toRootCommentReadModel),
      discussionTotal,
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
    if (comment.deletedAt) {
      throw new BadRequestException('Deleted comments cannot be hidden');
    }
    const hidden = await this.prisma.comment.update({
      where: { id: commentId },
      data: { isHidden: true },
      include: COMMENT_RELATIONS,
    });
    return toCommentReadModel(hidden);
  }

  async remove(commentId: string, user: { id: string; role: string }) {
    const comment = await this.findAccessRecord(commentId);
    const allowed =
      user.role === Role.ADMIN ||
      user.id === comment.authorId ||
      user.id === comment.tournament.organizerId;
    if (!allowed) throw new ForbiddenException('Comment deletion denied');

    if (comment.parentId === null && comment._count.replies > 0) {
      const tombstone = await this.prisma.comment.update({
        where: { id: commentId },
        data: { content: '', deletedAt: new Date(), isHidden: false },
        include: COMMENT_RELATIONS,
      });
      return {
        message: 'Comment deleted',
        commentId,
        tombstoned: true,
        comment: toCommentReadModel(tombstone),
      };
    }

    await this.prisma.comment.delete({ where: { id: commentId } });
    return { message: 'Comment deleted', commentId, tombstoned: false };
  }

  private async findAccessRecord(commentId: string) {
    const comment = await this.prisma.comment.findUnique({
      where: { id: commentId },
      select: {
        id: true,
        authorId: true,
        parentId: true,
        deletedAt: true,
        _count: { select: { replies: true } },
        tournament: { select: { organizerId: true } },
      },
    });
    if (!comment) throw new NotFoundException('Comment not found');
    return comment;
  }
}

function toCommentReadModel(comment: CommentReadRecord) {
  return {
    ...comment,
    content: comment.deletedAt ? '' : comment.content,
  };
}

function toRootCommentReadModel(comment: RootCommentReadRecord) {
  return {
    ...toCommentReadModel(comment),
    replies: comment.replies.map(toCommentReadModel),
    replyCount: comment.replies.length,
  };
}

function replyPreview(content: string) {
  return content.length <= 120 ? content : `${content.slice(0, 117)}...`;
}
