import { PrismaClient } from '@prisma/client';
import { GAME_CATALOG } from './game-catalog';

type GameCatalogSyncClient = Pick<PrismaClient, 'game'>;

export async function syncGameCatalog(
  prisma: GameCatalogSyncClient,
): Promise<string[]> {
  const synchronizedCodes: string[] = [];

  for (const game of GAME_CATALOG) {
    const metadata = {
      name: game.name,
      iconUrl: game.iconUrl,
      genre: game.genre,
      positionMode: game.positionMode,
      teamSizeMode: game.teamSizeMode,
      defaultTeamSize: game.defaultTeamSize,
      minTeamSize: game.minTeamSize,
      maxTeamSize: game.maxTeamSize,
      minSelectableTeamSize: game.minSelectableTeamSize,
      maxSelectableTeamSize: game.maxSelectableTeamSize,
    };

    const positions = game.positions.map((code, index) => ({
      code,
      orderIndex: index + 1,
    }));
    const allowedTeamSizes = game.allowedTeamSizes.map((size) => ({ size }));

    await prisma.game.upsert({
      where: { code: game.code },
      update: {
        ...metadata,
        positions: { deleteMany: {}, create: positions },
        allowedTeamSizes: { deleteMany: {}, create: allowedTeamSizes },
      },
      create: {
        code: game.code,
        ...metadata,
        positions: { create: positions },
        allowedTeamSizes: { create: allowedTeamSizes },
      },
    });
    synchronizedCodes.push(game.code);
  }

  return synchronizedCodes;
}
