/* eslint-disable @typescript-eslint/unbound-method */
import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentFavoriteService } from './tournament-favorite.service';

function harness(tournament: { id: string } | null = { id: 't-1' }) {
  const tx = {
    tournamentFavorite: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
      count: jest.fn().mockResolvedValue(3),
    },
  };
  const prisma = {
    tournament: { findUnique: jest.fn().mockResolvedValue(tournament) },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  return { service: new TournamentFavoriteService(prisma), prisma, tx };
}

describe('TournamentFavoriteService', () => {
  it('favorites idempotently through the database unique key', async () => {
    const { service, tx } = harness();

    await expect(service.favorite('user-1', 'cup')).resolves.toEqual({
      isFavorited: true,
      favoriteCount: 3,
    });
    expect(tx.tournamentFavorite.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', tournamentId: 't-1' }],
      skipDuplicates: true,
    });
  });

  it('unfavorites idempotently without deleting notification history', async () => {
    const { service, tx } = harness();

    await expect(service.unfavorite('user-1', 'cup')).resolves.toEqual({
      isFavorited: false,
      favoriteCount: 3,
    });
    expect(tx.tournamentFavorite.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', tournamentId: 't-1' },
    });
    expect(tx).not.toHaveProperty('notification');
  });

  it('rejects a missing tournament before mutating favorites', async () => {
    const { service, prisma } = harness(null);

    await expect(service.favorite('user-1', 'missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
