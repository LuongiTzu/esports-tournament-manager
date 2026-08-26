import { GamePositionMode, TeamSizeMode } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  assertValidGameCatalogEntry,
  GAME_CATALOG,
  GAME_CATALOG_CODES,
} from './game-catalog';
import { GamesService } from './games.service';

const catalogByCode = Object.fromEntries(
  GAME_CATALOG.map((game) => [game.code, game]),
);

describe('game catalog', () => {
  it('contains the eight established games and seven GF-1 additions', () => {
    expect(GAME_CATALOG).toHaveLength(15);
    expect(GAME_CATALOG.slice(0, 8).map((game) => game.name)).toEqual([
      'League of Legends',
      'Liên Quân Mobile',
      'Valorant',
      'Counter-Strike 2',
      'Dota 2',
      'Rocket League',
      'Tekken 8',
      'Street Fighter 6',
    ]);
    expect(GAME_CATALOG.slice(8).map((game) => game.name)).toEqual([
      'Mobile Legends: Bang Bang',
      'Honor of Kings',
      'League of Legends: Wild Rift',
      'FC Online',
      'CrossFire',
      'Pokémon UNITE',
      'Custom Game',
    ]);
  });

  it('does not introduce an Age of Empires catalog addition', () => {
    const gf1Names = GAME_CATALOG.slice(8).map((game) => game.name);
    expect(
      gf1Names.some((name) =>
        /^(Age of Empires|AoE(?:\s(?:I|II|IV|Rise of Rome))?)$/i.test(name),
      ),
    ).toBe(false);
  });

  it('preserves all established game roster and position metadata', () => {
    expect(GAME_CATALOG.slice(0, 8)).toEqual([
      expect.objectContaining({
        code: 'LEAGUE_OF_LEGENDS',
        defaultTeamSize: 5,
        minTeamSize: 5,
        maxTeamSize: 7,
        positions: ['TOP', 'JUNGLE', 'MID', 'BOT', 'SUPPORT'],
        positionMode: GamePositionMode.FIXED,
      }),
      expect.objectContaining({
        code: 'LIEN_QUAN_MOBILE',
        defaultTeamSize: 5,
        minTeamSize: 5,
        maxTeamSize: 7,
        positions: ['DARK_SLAYER_LANE', 'JUNGLE', 'MID', 'DRAGON_LANE', 'ROAM'],
        positionMode: GamePositionMode.FIXED,
      }),
      expect.objectContaining({
        code: 'VALORANT',
        defaultTeamSize: 5,
        minTeamSize: 5,
        maxTeamSize: 7,
        positions: ['DUELIST', 'INITIATOR', 'CONTROLLER', 'SENTINEL'],
        positionMode: GamePositionMode.OPTIONAL,
      }),
      expect.objectContaining({
        code: 'COUNTER_STRIKE_2',
        defaultTeamSize: 5,
        minTeamSize: 5,
        maxTeamSize: 7,
        positions: [],
        positionMode: GamePositionMode.NONE,
      }),
      expect.objectContaining({
        code: 'DOTA_2',
        defaultTeamSize: 5,
        minTeamSize: 5,
        maxTeamSize: 7,
        positions: [
          'POSITION_1',
          'POSITION_2',
          'POSITION_3',
          'POSITION_4',
          'POSITION_5',
        ],
        positionMode: GamePositionMode.FIXED,
      }),
      expect.objectContaining({
        code: 'ROCKET_LEAGUE',
        defaultTeamSize: 3,
        minTeamSize: 3,
        maxTeamSize: 4,
        positions: [],
        positionMode: GamePositionMode.NONE,
      }),
      expect.objectContaining({
        code: 'TEKKEN_8',
        defaultTeamSize: 1,
        minTeamSize: 1,
        maxTeamSize: 1,
        positions: [],
        positionMode: GamePositionMode.NONE,
      }),
      expect.objectContaining({
        code: 'STREET_FIGHTER_6',
        defaultTeamSize: 1,
        minTeamSize: 1,
        maxTeamSize: 1,
        positions: [],
        positionMode: GamePositionMode.NONE,
      }),
    ]);
    for (const game of GAME_CATALOG.slice(0, 8)) {
      expect(game.teamSizeMode).toBe(TeamSizeMode.FIXED);
      expect(game.allowedTeamSizes).toEqual([]);
      expect(game.minSelectableTeamSize).toBeNull();
      expect(game.maxSelectableTeamSize).toBeNull();
    }
  });

  it.each([
    [
      'MLBB',
      7,
      GamePositionMode.FIXED,
      ['EXP_LANE', 'JUNGLE', 'MID_LANE', 'GOLD_LANE', 'ROAM'],
    ],
    [
      'HONOR_OF_KINGS',
      8,
      GamePositionMode.FIXED,
      ['CLASH_LANE', 'JUNGLE', 'MID_LANE', 'FARM_LANE', 'ROAM'],
    ],
    [
      'WILD_RIFT',
      8,
      GamePositionMode.FIXED,
      ['SOLO_LANE', 'JUNGLE', 'MID_LANE', 'DUO_LANE', 'SUPPORT'],
    ],
    [
      'CROSSFIRE_PC',
      6,
      GamePositionMode.OPTIONAL,
      ['ORDER', 'ATTACKER', 'SNIPER', 'TACTICAL_BACKUP'],
    ],
    ['POKEMON_UNITE', 6, GamePositionMode.NONE, []],
  ] as const)(
    'defines fixed metadata and canonical positions for %s',
    (code, maxTeamSize, positionMode, positions) => {
      expect(catalogByCode[code]).toMatchObject({
        code,
        teamSizeMode: TeamSizeMode.FIXED,
        defaultTeamSize: 5,
        maxTeamSize,
        allowedTeamSizes: [],
        positionMode,
        positions,
      });
    },
  );

  it('defines FC Online as the 1-or-3 PRESET game', () => {
    expect(catalogByCode.FC_ONLINE).toMatchObject({
      teamSizeMode: TeamSizeMode.PRESET,
      defaultTeamSize: 3,
      minTeamSize: 1,
      maxTeamSize: 4,
      allowedTeamSizes: [1, 3],
      positionMode: GamePositionMode.NONE,
      positions: [],
    });
  });

  it('identifies Custom by code and defines its FLEXIBLE bounds', () => {
    const custom = GAME_CATALOG.find((game) => game.code === 'CUSTOM');
    expect(custom).toMatchObject({
      code: 'CUSTOM',
      name: 'Custom Game',
      teamSizeMode: TeamSizeMode.FLEXIBLE,
      defaultTeamSize: 1,
      minTeamSize: 1,
      maxTeamSize: 30,
      allowedTeamSizes: [],
      minSelectableTeamSize: 1,
      maxSelectableTeamSize: 20,
      positionMode: GamePositionMode.NONE,
      positions: [],
    });
  });

  it('rejects malformed static PRESET metadata', () => {
    expect(() =>
      assertValidGameCatalogEntry({
        ...catalogByCode.FC_ONLINE,
        allowedTeamSizes: [3, 1, 3],
      }),
    ).toThrow('PRESET metadata is inconsistent');
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

  it('returns only games identified by canonical machine codes', async () => {
    const games = GAME_CATALOG.map((game, index) => ({
      id: `game-${index}`,
      iconUrl: null,
      ...game,
    }));
    (prisma.game.findMany as jest.Mock).mockResolvedValue(games);

    await expect(service.findAll()).resolves.toEqual(games);
    expect(prisma.game.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { code: { in: GAME_CATALOG_CODES } },
        orderBy: { name: 'asc' },
        select: expect.objectContaining({
          code: true,
          positionMode: true,
          teamSizeMode: true,
          allowedTeamSizes: true,
          minSelectableTeamSize: true,
          maxSelectableTeamSize: true,
        }),
      }),
    );
  });

  it('returns stable position codes and position mode', async () => {
    (prisma.game.findFirst as jest.Mock).mockResolvedValue({
      id: 'lol',
      iconUrl: null,
      ...catalogByCode.LEAGUE_OF_LEGENDS,
    });

    await expect(service.findPositions('lol')).resolves.toEqual(
      expect.objectContaining({
        positions: ['TOP', 'JUNGLE', 'MID', 'BOT', 'SUPPORT'],
        positionMode: GamePositionMode.FIXED,
      }),
    );
    expect(prisma.game.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          id: 'lol',
          code: { in: GAME_CATALOG_CODES },
        },
      }),
    );
  });
});
