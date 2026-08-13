/* eslint-disable @typescript-eslint/unbound-method */
import { ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentEventsService } from '../tournaments/tournament-events.service';
import { CommentService } from './comment.service';
import { ContentFilterService } from '../common/services/content-filter.service';

function harness() {
  const prisma = {
    tournament: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 't-1', organizerId: 'organizer' }),
    },
    comment: {
      create: jest.fn().mockResolvedValue({
        id: 'c-1',
        content: 'Hello',
        authorId: 'author',
        tournamentId: 't-1',
      }),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      findUnique: jest.fn().mockResolvedValue({
        id: 'c-1',
        authorId: 'author',
        tournament: { organizerId: 'organizer' },
      }),
      update: jest.fn().mockResolvedValue({ id: 'c-1', isHidden: true }),
      delete: jest.fn().mockResolvedValue({ id: 'c-1' }),
    },
  } as unknown as PrismaService;
  const filter = { validate: jest.fn((content: string) => content.trim()) };
  const events = { publish: jest.fn() };
  return {
    service: new CommentService(
      prisma,
      filter as unknown as ContentFilterService,
      events as unknown as TournamentEventsService,
    ),
    prisma,
    filter,
    events,
  };
}

describe('CommentService', () => {
  it('creates a tournament comment for the authenticated author and emits it', async () => {
    const { service, prisma, filter, events } = harness();

    const result = await service.create('cup', 'author', ' Hello ');

    expect(filter.validate).toHaveBeenCalledWith(' Hello ');
    expect(prisma.comment.create).toHaveBeenCalledWith({
      data: { content: 'Hello', authorId: 'author', tournamentId: 't-1' },
      include: {
        author: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
      },
    });
    expect(events.publish).toHaveBeenCalledWith({
      tournamentId: 't-1',
      event: 'newComment',
      payload: result,
    });
  });

  it('paginates and excludes hidden comments for normal users', async () => {
    const { service, prisma } = harness();
    jest.mocked(prisma.comment.count).mockResolvedValue(41);

    await expect(
      service.findByTournament(
        'cup',
        { id: 'viewer', role: Role.SIGNED_UP_USER },
        { page: 2, limit: 20 },
      ),
    ).resolves.toEqual({
      data: [],
      pagination: { page: 2, limit: 20, total: 41, totalPages: 3 },
    });
    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tournamentId: 't-1', isHidden: false },
        skip: 20,
        take: 20,
      }),
    );
  });

  it.each([
    ['organizer', Role.SIGNED_UP_USER],
    ['admin', Role.ADMIN],
  ] as const)('allows %s to see hidden comments', async (id, role) => {
    const { service, prisma } = harness();
    await service.findByTournament('cup', { id, role });
    expect(prisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tournamentId: 't-1', isHidden: undefined },
      }),
    );
  });

  it.each([
    ['author', Role.SIGNED_UP_USER],
    ['organizer', Role.SIGNED_UP_USER],
    ['admin', Role.ADMIN],
  ] as const)('allows %s to delete a comment', async (id, role) => {
    const { service, prisma } = harness();
    await service.remove('c-1', { id, role });
    expect(prisma.comment.delete).toHaveBeenCalledWith({
      where: { id: 'c-1' },
    });
  });

  it('rejects unauthorized deletion', async () => {
    const { service, prisma } = harness();
    await expect(
      service.remove('c-1', { id: 'stranger', role: Role.SIGNED_UP_USER }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.comment.delete).not.toHaveBeenCalled();
  });

  it.each([
    ['organizer', Role.SIGNED_UP_USER],
    ['admin', Role.ADMIN],
  ] as const)('allows %s to hide a comment', async (id, role) => {
    const { service, prisma } = harness();
    await service.hide('c-1', { id, role });
    expect(prisma.comment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'c-1' },
        data: { isHidden: true },
      }),
    );
  });

  it('rejects unauthorized hide', async () => {
    const { service, prisma } = harness();
    await expect(
      service.hide('c-1', { id: 'author', role: Role.SIGNED_UP_USER }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.comment.update).not.toHaveBeenCalled();
  });
});
