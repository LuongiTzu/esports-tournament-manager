/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { ContentFilterService } from '../common/services/content-filter.service';
import { PrismaService } from '../prisma/prisma.service';
import { RatingService } from './rating.service';

const tournament = {
  id: 'tournament-1',
  status: 'COMPLETED',
  organizerId: 'organizer-1',
};
const author = {
  id: 'user-1',
  emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
} as AuthenticatedUser;

function harness() {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: tournament.id }]),
    tournament: { findUnique: jest.fn().mockResolvedValue(tournament) },
    tournamentRating: {
      findMany: jest.fn().mockResolvedValue([{ id: 'visible-1', score: 5 }]),
      aggregate: jest.fn().mockResolvedValue({
        _avg: { score: 5 },
        _count: 1,
      }),
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'rating-1', score: 5 }),
      update: jest.fn().mockResolvedValue({ id: 'rating-1', score: 4 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(1),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
    tournament: tx.tournament,
    tournamentRating: tx.tournamentRating,
  } as unknown as PrismaService;
  const filter = {
    validate: jest.fn((value: string) => value.trim()),
  } as unknown as ContentFilterService;
  return { service: new RatingService(prisma, filter), prisma, tx, filter };
}

describe('RatingService', () => {
  it('lists only public ratings but returns the author’s hidden rating and editing permissions', async () => {
    const { service, tx } = harness();
    tx.tournamentRating.findUnique.mockResolvedValue({
      id: 'hidden-mine',
      score: 3,
      isHidden: true,
      moderationReason: 'Hidden by admin',
    });

    const result = await service.list('cup', author, { page: 2, limit: 100 });

    expect(tx.tournamentRating.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { tournamentId: tournament.id, isHidden: false },
        skip: 50,
        take: 50,
      }),
    );
    expect(result.summary).toEqual({ average: 5, count: 1 });
    expect(result.mine).toEqual(
      expect.objectContaining({ id: 'hidden-mine', isHidden: true }),
    );
    expect(result.eligibility).toEqual({
      reason: 'ALLOWED',
      canCreate: false,
      canEdit: true,
      canDelete: true,
    });
  });

  it('allows every verified account after login checks without exposing an author rating', async () => {
    const { service, tx } = harness();

    const guest = await service.list('cup', undefined, {});
    expect(guest.eligibility.reason).toBe('LOGIN_REQUIRED');
    expect(tx.tournamentRating.findUnique).not.toHaveBeenCalled();

    const unverified = await service.list(
      'cup',
      {
        ...author,
        emailVerifiedAt: null,
      },
      {},
    );
    expect(unverified.eligibility.reason).toBe('VERIFY_EMAIL');

    const outsider = await service.list('cup', author, {});
    expect(outsider.eligibility.reason).toBe('ALLOWED');
    expect(outsider.eligibility.canCreate).toBe(true);
  });

  it('rejects organizer and unfinished tournament before writing a rating', async () => {
    const { service, tx } = harness();

    await expect(
      service.save(
        'cup',
        { ...author, id: tournament.organizerId },
        { score: 5 },
        true,
      ),
    ).rejects.toMatchObject({
      response: expect.objectContaining({ reason: 'ORGANIZER' }),
    });
    tx.tournament.findUnique.mockResolvedValue({
      ...tournament,
      status: 'ONGOING',
    });
    await expect(
      service.save('cup', author, { score: 5 }, true),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(tx.tournamentRating.create).not.toHaveBeenCalled();
  });

  it('creates a rating after locking the tournament and normalizes optional content', async () => {
    const { service, tx } = harness();

    await service.save(
      'cup',
      author,
      { score: 5, content: ' Great event ' },
      true,
    );

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(tx.tournamentRating.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          tournamentId: tournament.id,
          authorId: author.id,
          score: 5,
          content: 'Great event',
        },
      }),
    );
  });

  it('updates an existing rating without clearing moderation and rejects a missing rating', async () => {
    const { service, tx } = harness();

    await expect(
      service.save('cup', author, { score: 4 }, false),
    ).rejects.toBeInstanceOf(NotFoundException);
    tx.tournamentRating.findUnique.mockResolvedValue({
      id: 'rating-1',
      isHidden: true,
    });
    await service.save('cup', author, { score: 4, content: ' ' }, false);

    expect(tx.tournamentRating.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tournamentId_authorId: {
            tournamentId: tournament.id,
            authorId: author.id,
          },
        },
        data: { score: 4, content: null },
      }),
    );
  });

  it('converts the database uniqueness race into a conflict response', async () => {
    const { service, tx } = harness();
    tx.tournamentRating.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('Unique constraint', {
        code: 'P2002',
        clientVersion: '6.19.3',
      }),
    );

    await expect(
      service.save('cup', author, { score: 5 }, true),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('deletes only the author’s rating and reports a missing row', async () => {
    const { service, tx } = harness();

    await expect(service.remove('cup', author.id)).resolves.toEqual({
      deleted: true,
    });
    expect(tx.tournamentRating.deleteMany).toHaveBeenCalledWith({
      where: { tournamentId: tournament.id, authorId: author.id },
    });
    tx.tournamentRating.deleteMany.mockResolvedValue({ count: 0 });
    await expect(service.remove('cup', author.id)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('restricts public moderation to admin decisions with a reason when hiding', async () => {
    const { service, tx } = harness();

    await expect(
      service.moderate('rating-1', 'admin-1', { isHidden: true, reason: '  ' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.tournamentRating.updateMany).not.toHaveBeenCalled();

    await service.moderate('rating-1', 'admin-1', {
      isHidden: true,
      reason: ' Policy violation ',
    });
    expect(tx.tournamentRating.updateMany).toHaveBeenCalledWith({
      where: { id: 'rating-1' },
      data: {
        isHidden: true,
        moderationReason: 'Policy violation',
        moderatedBy: 'admin-1',
        moderatedAt: expect.any(Date),
      },
    });

    await service.moderate('rating-1', 'admin-1', { isHidden: false });
    expect(tx.tournamentRating.updateMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ moderationReason: null }),
      }),
    );
    tx.tournamentRating.updateMany.mockResolvedValue({ count: 0 });
    await expect(
      service.moderate('unknown', 'admin-1', { isHidden: false }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('paginates admin ratings and filters by moderation status', async () => {
    const { service, tx } = harness();

    const result = await service.adminList({
      page: 2,
      limit: 1,
      isHidden: true,
    });

    expect(tx.tournamentRating.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isHidden: true },
        skip: 1,
        take: 1,
      }),
    );
    expect(result.pagination).toEqual({
      page: 2,
      limit: 1,
      total: 1,
      totalPages: 1,
    });
  });
});
