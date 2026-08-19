import { GameGenre, GamePositionMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GAME_CATALOG, GAME_CATALOG_NAMES } from './game-catalog';
import { GamesService } from './games.service';

describe('game catalog', () => {
  it('contains exactly the approved active games', () => {
    expect(GAME_CATALOG.map((game) => game.name)).toEqual([
      'League of Legends',
      'Liên Quân Mobile',
      'Valorant',
      'Counter-Strike 2',
      'Dota 2',
      'Rocket League',
      'Tekken 8',
      'Street Fighter 6',
    ]);
    expect(GAME_CATALOG.some((game) => game.name === 'PUBG Mobile')).toBe(
      false,
    );
    expect(GAME_CATALOG.some((game) => game.name === 'FC Online')).toBe(false);
  });

  it('defines team sizes and stable position codes', () => {
    const byName = Object.fromEntries(
      GAME_CATALOG.map((game) => [game.name, game]),
    );

    expect(byName['League of Legends']).toMatchObject({
      defaultTeamSize: 5,
      positions: ['TOP', 'JUNGLE', 'MID', 'BOT', 'SUPPORT'],
      positionMode: GamePositionMode.FIXED,
    });
    expect(byName['Liên Quân Mobile']).toMatchObject({
      defaultTeamSize: 5,
      positions: ['DARK_SLAYER_LANE', 'JUNGLE', 'MID', 'DRAGON_LANE', 'ROAM'],
      positionMode: GamePositionMode.FIXED,
    });
    expect(byName.Valorant).toMatchObject({
      defaultTeamSize: 5,
      positions: ['DUELIST', 'INITIATOR', 'CONTROLLER', 'SENTINEL'],
      positionMode: GamePositionMode.OPTIONAL,
    });
    expect(byName['Dota 2']).toMatchObject({
      defaultTeamSize: 5,
      positions: [
        'POSITION_1',
        'POSITION_2',
        'POSITION_3',
        'POSITION_4',
        'POSITION_5',
      ],
      positionMode: GamePositionMode.FIXED,
    });
    expect(byName['Counter-Strike 2']).toMatchObject({
      defaultTeamSize: 5,
      positions: [],
      positionMode: GamePositionMode.NONE,
    });
    expect(byName['Rocket League']).toMatchObject({
      defaultTeamSize: 3,
      positions: [],
      positionMode: GamePositionMode.NONE,
    });
    for (const name of ['Tekken 8', 'Street Fighter 6']) {
      expect(byName[name]).toMatchObject({
        genre: GameGenre.FIGHTING,
        defaultTeamSize: 1,
        positions: [],
        positionMode: GamePositionMode.NONE,
      });
    }
  });
});

describe('GamesService', () => {
  const prisma = {
    game: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
  } as unknown as PrismaService;
  const service = new GamesService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it('returns only active catalog games', async () => {
    const games = GAME_CATALOG.map((game, index) => ({
      id: `game-${index}`,
      iconUrl: null,
      ...game,
    }));
    (prisma.game.findMany as jest.Mock).mockResolvedValue(games);

    await expect(service.findAll()).resolves.toEqual(games);
    expect(prisma.game.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { name: { in: GAME_CATALOG_NAMES } },
      }),
    );
  });

  it('returns stable codes and position mode', async () => {
    (prisma.game.findFirst as jest.Mock).mockResolvedValue({
      id: 'lol',
      name: 'League of Legends',
      iconUrl: null,
      genre: GameGenre.MOBA,
      positions: ['TOP'],
      positionMode: GamePositionMode.FIXED,
      defaultTeamSize: 5,
      minTeamSize: 5,
      maxTeamSize: 7,
    });

    await expect(service.findPositions('lol')).resolves.toEqual(
      expect.objectContaining({
        positions: ['TOP'],
        positionMode: GamePositionMode.FIXED,
      }),
    );
  });
});
