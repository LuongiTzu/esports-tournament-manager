import { Prisma, PrismaClient } from '@prisma/client';
import { GAME_CATALOG } from './game-catalog';

type GameCatalogSyncClient = Pick<PrismaClient, 'game'>;

export async function syncGameCatalog(
  prisma: GameCatalogSyncClient,
): Promise<string[]> {
  const synchronizedCodes: string[] = [];

  for (const game of GAME_CATALOG) {
    const metadata = {
      name: game.name,
      genre: game.genre,
      positions: game.positions,
      positionMode: game.positionMode,
      teamSizeMode: game.teamSizeMode,
      defaultTeamSize: game.defaultTeamSize,
      minTeamSize: game.minTeamSize,
      maxTeamSize: game.maxTeamSize,
      allowedTeamSizes: game.allowedTeamSizes,
      minSelectableTeamSize: game.minSelectableTeamSize,
      maxSelectableTeamSize: game.maxSelectableTeamSize,
    } satisfies Omit<Prisma.GameCreateInput, 'code'>;

    await prisma.game.upsert({
      where: { code: game.code },
      update: metadata,
      create: { code: game.code, ...metadata },
    });
    synchronizedCodes.push(game.code);
  }

  return synchronizedCodes;
}
