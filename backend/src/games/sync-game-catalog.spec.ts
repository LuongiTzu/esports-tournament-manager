import { PrismaClient } from '@prisma/client';
import { GAME_CATALOG } from './game-catalog';
import { syncGameCatalog } from './sync-game-catalog';

describe('syncGameCatalog', () => {
  it('upserts every canonical definition exclusively by stable code', async () => {
    const upsert = jest.fn().mockResolvedValue({});
    const deleteMany = jest.fn();
    const tournamentDeleteMany = jest.fn();
    const bannedKeywordDeleteMany = jest.fn();
    const prisma = {
      game: { upsert, deleteMany },
      tournament: { deleteMany: tournamentDeleteMany },
      bannedKeyword: { deleteMany: bannedKeywordDeleteMany },
    } as unknown as Pick<PrismaClient, 'game'>;

    await expect(syncGameCatalog(prisma)).resolves.toEqual(
      GAME_CATALOG.map((game) => game.code),
    );
    expect(upsert).toHaveBeenCalledTimes(GAME_CATALOG.length);
    for (const [index, game] of GAME_CATALOG.entries()) {
      expect(upsert.mock.calls[index][0]).toEqual(
        expect.objectContaining({
          where: { code: game.code },
          create: expect.objectContaining({ code: game.code, name: game.name }),
          update: expect.objectContaining({ name: game.name }),
        }),
      );
    }
    expect(deleteMany).not.toHaveBeenCalled();
    expect(tournamentDeleteMany).not.toHaveBeenCalled();
    expect(bannedKeywordDeleteMany).not.toHaveBeenCalled();
  });
});
