/* eslint-disable @typescript-eslint/unbound-method */
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import type { NotificationPublisher } from '../common/ports/notification-publisher';
import type { TournamentEventPublisher } from '../common/ports/tournament-event-publisher';
import { CommentService } from './comment.service';
import { ContentFilterService } from '../common/services/content-filter.service';

const author = { id: 'author', displayName: 'Author', avatarUrl: null };
const targetAuthor = {
  id: 'target-author',
  displayName: 'Target User',
  avatarUrl: null,
};

function commentRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c-1',
    content: 'Hello',
    isHidden: false,
    deletedAt: null,
    createdAt: new Date('2026-08-28T01:00:00.000Z'),
    updatedAt: new Date('2026-08-28T01:00:00.000Z'),
    authorId: author.id,
    tournamentId: 't-1',
    parentId: null,
    replyToUserId: null,
    author,
    replyToUser: null,
    ...overrides,
  };
}

function rootTarget(overrides: Record<string, unknown> = {}) {
  return {
    id: 'root-1',
    authorId: targetAuthor.id,
    tournamentId: 't-1',
    parentId: null,
    isHidden: false,
    deletedAt: null,
    author: targetAuthor,
    parent: null,
    ...overrides,
  };
}

function harness() {
  const comment = {
    create: jest.fn().mockResolvedValue(commentRecord()),
    findMany: jest.fn().mockResolvedValue([]),
    count: jest.fn().mockResolvedValue(0),
    findUnique: jest.fn().mockResolvedValue({
      id: 'c-1',
      authorId: author.id,
      parentId: null,
      deletedAt: null,
      _count: { replies: 0 },
      tournament: { organizerId: 'organizer' },
    }),
    update: jest.fn().mockResolvedValue(commentRecord({ isHidden: true })),
    delete: jest.fn().mockResolvedValue({ id: 'c-1' }),
  };
  const notification = { create: jest.fn() };
  const prisma = {
    tournament: {
      findUnique: jest.fn().mockResolvedValue({
        id: 't-1',
        name: 'Arena Cup',
        organizerId: 'organizer',
      }),
    },
    comment,
    $transaction: jest.fn(
      (
        callback: (tx: {
          comment: typeof comment;
          notification: typeof notification;
        }) => unknown,
      ) => callback({ comment, notification }),
    ),
  } as unknown as PrismaService;
  const filter = { validate: jest.fn((content: string) => content.trim()) };
  const events = { publish: jest.fn() };
  const notifications = {
    createNotification: jest.fn().mockResolvedValue({ id: 'notification-1' }),
    emitCreated: jest.fn(),
  };
  return {
    service: new CommentService(
      prisma,
      filter as unknown as ContentFilterService,
      events as unknown as TournamentEventPublisher,
      notifications as unknown as NotificationPublisher,
    ),
    prisma,
    comment,
    filter,
    events,
    notifications,
  };
}

describe('CommentService', () => {
  it('creates a root comment with no reply relationships and emits it', async () => {
    const { service, comment, filter, events, notifications } = harness();

    const result = await service.create('cup', author.id, ' Hello ');

    expect(filter.validate).toHaveBeenCalledWith(' Hello ');
    expect(comment.create).toHaveBeenCalledWith({
      data: {
        content: 'Hello',
        authorId: author.id,
        tournamentId: 't-1',
        parentId: undefined,
        replyToUserId: undefined,
      },
      include: expect.any(Object),
    });
    expect(notifications.createNotification).not.toHaveBeenCalled();
    expect(events.publish).toHaveBeenCalledWith({
      tournamentId: 't-1',
      event: 'newComment',
      payload: result,
    });
  });

  it('replies to a root and notifies only the exact target author', async () => {
    const { service, comment, notifications } = harness();
    comment.findUnique.mockResolvedValue(rootTarget());
    comment.create.mockResolvedValue(
      commentRecord({
        id: 'reply-1',
        parentId: 'root-1',
        replyToUserId: targetAuthor.id,
        replyToUser: targetAuthor,
      }),
    );

    const result = await service.create('cup', author.id, 'Reply 🔥', 'root-1');

    expect(comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentId: 'root-1',
          replyToUserId: targetAuthor.id,
        }),
      }),
    );
    expect(result.parentId).toBe('root-1');
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: targetAuthor.id,
        type: NotificationType.COMMENT_REPLY,
        data: expect.objectContaining({
          kind: 'COMMENT_REPLY',
          rootCommentId: 'root-1',
          replyCommentId: 'reply-1',
          replierId: author.id,
        }),
      }),
      expect.any(Object),
      false,
    );
    const notificationInput = notifications.createNotification.mock.calls[0][0];
    expect(notificationInput.content).not.toContain('root-1');
    expect(notificationInput.content).not.toContain('reply-1');
    expect(notifications.emitCreated).toHaveBeenCalledWith({
      id: 'notification-1',
    });
  });

  it('flattens reply-to-reply under the root and targets the clicked author', async () => {
    const { service, comment, notifications } = harness();
    comment.findUnique.mockResolvedValue(
      rootTarget({
        id: 'reply-b',
        authorId: 'user-b',
        parentId: 'root-1',
        author: { id: 'user-b', displayName: 'User B', avatarUrl: null },
        parent: {
          id: 'root-1',
          parentId: null,
          tournamentId: 't-1',
          isHidden: false,
          deletedAt: null,
        },
      }),
    );
    comment.create.mockResolvedValue(
      commentRecord({
        id: 'reply-c',
        parentId: 'root-1',
        replyToUserId: 'user-b',
        replyToUser: { id: 'user-b', displayName: 'User B', avatarUrl: null },
      }),
    );

    await service.create('cup', author.id, 'Reply to B', 'reply-b');

    expect(comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          parentId: 'root-1',
          replyToUserId: 'user-b',
        }),
      }),
    );
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-b' }),
      expect.any(Object),
      false,
    );
  });

  it('does not notify a user replying to their own comment', async () => {
    const { service, comment, notifications } = harness();
    comment.findUnique.mockResolvedValue(
      rootTarget({ authorId: author.id, author }),
    );
    comment.create.mockResolvedValue(
      commentRecord({
        parentId: 'root-1',
        replyToUserId: author.id,
        replyToUser: author,
      }),
    );

    await service.create('cup', author.id, 'Self reply', 'root-1');

    expect(notifications.createNotification).not.toHaveBeenCalled();
    expect(notifications.emitCreated).not.toHaveBeenCalled();
  });

  it('rejects a cross-tournament reply target', async () => {
    const { service, comment } = harness();
    comment.findUnique.mockResolvedValue(rootTarget({ tournamentId: 't-2' }));
    await expect(
      service.create('cup', author.id, 'No', 'other-comment'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(comment.create).not.toHaveBeenCalled();
  });

  it('rejects an unknown reply target', async () => {
    const { service, comment } = harness();
    comment.findUnique.mockResolvedValue(null);
    await expect(
      service.create('cup', author.id, 'No', 'missing'),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it.each([{ isHidden: true }, { deletedAt: new Date() }])(
    'rejects an inaccessible reply target: %p',
    async (state) => {
      const { service, comment } = harness();
      comment.findUnique.mockResolvedValue(rootTarget(state));
      await expect(
        service.create('cup', author.id, 'No', 'root-1'),
      ).rejects.toBeInstanceOf(BadRequestException);
    },
  );

  it('reuses the comment content filter for replies', async () => {
    const { service, comment, filter } = harness();
    comment.findUnique.mockResolvedValue(rootTarget());
    await service.create('cup', author.id, ' Reply ', 'root-1');
    expect(filter.validate).toHaveBeenCalledWith(' Reply ');
    expect(comment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ content: 'Reply' }),
      }),
    );
  });

  it('paginates roots and returns replies oldest-first at one level', async () => {
    const { service, comment } = harness();
    const reply = commentRecord({
      id: 'reply-1',
      parentId: 'root-1',
      replyToUserId: targetAuthor.id,
      replyToUser: targetAuthor,
    });
    comment.findMany.mockResolvedValue([
      { ...commentRecord({ id: 'root-1' }), replies: [reply] },
    ]);
    comment.count.mockResolvedValueOnce(1).mockResolvedValueOnce(2);

    const result = await service.findByTournament('cup', {
      id: 'viewer',
      role: Role.SIGNED_UP_USER,
    });

    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 'root-1',
        replyCount: 1,
        replies: [
          expect.objectContaining({ id: 'reply-1', parentId: 'root-1' }),
        ],
      }),
    );
    expect(result.discussionTotal).toBe(2);
    expect(comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ parentId: null }),
        orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
        include: expect.objectContaining({
          replies: expect.objectContaining({
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          }),
        }),
      }),
    );
  });

  it('excludes hidden roots and replies for normal viewers', async () => {
    const { service, comment } = harness();
    await service.findByTournament('cup', {
      id: 'viewer',
      role: Role.SIGNED_UP_USER,
    });
    expect(comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isHidden: false, parentId: null }),
        include: expect.objectContaining({
          replies: expect.objectContaining({ where: { isHidden: false } }),
        }),
      }),
    );
  });

  it('allows organizer moderation visibility for root and replies', async () => {
    const { service, comment } = harness();
    await service.findByTournament('cup', {
      id: 'organizer',
      role: Role.SIGNED_UP_USER,
    });
    expect(comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isHidden: undefined }),
        include: expect.objectContaining({
          replies: expect.objectContaining({ where: { isHidden: undefined } }),
        }),
      }),
    );
  });

  it('tombstones a root with replies instead of deleting the thread', async () => {
    const { service, comment } = harness();
    comment.findUnique.mockResolvedValue({
      id: 'root-1',
      authorId: author.id,
      parentId: null,
      deletedAt: null,
      _count: { replies: 2 },
      tournament: { organizerId: 'organizer' },
    });
    comment.update.mockResolvedValue(
      commentRecord({ id: 'root-1', content: '', deletedAt: new Date() }),
    );

    const result = await service.remove('root-1', {
      id: author.id,
      role: Role.SIGNED_UP_USER,
    });

    expect(result.tombstoned).toBe(true);
    expect(comment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ content: '', isHidden: false }),
      }),
    );
    expect(comment.delete).not.toHaveBeenCalled();
  });

  it('hard-deletes an owned leaf reply without affecting siblings', async () => {
    const { service, comment } = harness();
    comment.findUnique.mockResolvedValue({
      id: 'reply-1',
      authorId: author.id,
      parentId: 'root-1',
      deletedAt: null,
      _count: { replies: 0 },
      tournament: { organizerId: 'organizer' },
    });
    const result = await service.remove('reply-1', {
      id: author.id,
      role: Role.SIGNED_UP_USER,
    });
    expect(result.tombstoned).toBe(false);
    expect(comment.delete).toHaveBeenCalledWith({ where: { id: 'reply-1' } });
  });

  it('allows an organizer to hide a reply', async () => {
    const { service, comment } = harness();
    comment.findUnique.mockResolvedValue({
      id: 'reply-1',
      authorId: author.id,
      parentId: 'root-1',
      deletedAt: null,
      _count: { replies: 0 },
      tournament: { organizerId: 'organizer' },
    });
    await service.hide('reply-1', {
      id: 'organizer',
      role: Role.SIGNED_UP_USER,
    });
    expect(comment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'reply-1' },
        data: { isHidden: true },
      }),
    );
  });

  it('rejects unauthorized deletion', async () => {
    const { service, comment } = harness();
    await expect(
      service.remove('c-1', {
        id: 'stranger',
        role: Role.SIGNED_UP_USER,
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(comment.delete).not.toHaveBeenCalled();
  });
});
