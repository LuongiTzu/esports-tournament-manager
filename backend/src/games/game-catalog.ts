import { GameGenre, GamePositionMode } from '@prisma/client';

export interface GameCatalogEntry {
  name: string;
  genre: GameGenre;
  positions: string[];
  positionMode: GamePositionMode;
  defaultTeamSize: number;
  minTeamSize: number;
  maxTeamSize: number;
}

export const GAME_CATALOG: GameCatalogEntry[] = [
  {
    name: 'League of Legends',
    genre: GameGenre.MOBA,
    positions: ['TOP', 'JUNGLE', 'MID', 'BOT', 'SUPPORT'],
    positionMode: GamePositionMode.FIXED,
    defaultTeamSize: 5,
    minTeamSize: 5,
    maxTeamSize: 7,
  },
  {
    name: 'Liên Quân Mobile',
    genre: GameGenre.MOBA,
    positions: ['DARK_SLAYER_LANE', 'JUNGLE', 'MID', 'DRAGON_LANE', 'ROAM'],
    positionMode: GamePositionMode.FIXED,
    defaultTeamSize: 5,
    minTeamSize: 5,
    maxTeamSize: 7,
  },
  {
    name: 'Valorant',
    genre: GameGenre.FPS,
    positions: ['DUELIST', 'INITIATOR', 'CONTROLLER', 'SENTINEL'],
    positionMode: GamePositionMode.OPTIONAL,
    defaultTeamSize: 5,
    minTeamSize: 5,
    maxTeamSize: 7,
  },
  {
    name: 'Counter-Strike 2',
    genre: GameGenre.FPS,
    positions: [],
    positionMode: GamePositionMode.NONE,
    defaultTeamSize: 5,
    minTeamSize: 5,
    maxTeamSize: 7,
  },
  {
    name: 'Dota 2',
    genre: GameGenre.MOBA,
    positions: [
      'POSITION_1',
      'POSITION_2',
      'POSITION_3',
      'POSITION_4',
      'POSITION_5',
    ],
    positionMode: GamePositionMode.FIXED,
    defaultTeamSize: 5,
    minTeamSize: 5,
    maxTeamSize: 7,
  },
  {
    name: 'Rocket League',
    genre: GameGenre.SPORTS,
    positions: [],
    positionMode: GamePositionMode.NONE,
    defaultTeamSize: 3,
    minTeamSize: 3,
    maxTeamSize: 4,
  },
  {
    name: 'Tekken 8',
    genre: GameGenre.FIGHTING,
    positions: [],
    positionMode: GamePositionMode.NONE,
    defaultTeamSize: 1,
    minTeamSize: 1,
    maxTeamSize: 1,
  },
  {
    name: 'Street Fighter 6',
    genre: GameGenre.FIGHTING,
    positions: [],
    positionMode: GamePositionMode.NONE,
    defaultTeamSize: 1,
    minTeamSize: 1,
    maxTeamSize: 1,
  },
];

export const GAME_CATALOG_NAMES = GAME_CATALOG.map((game) => game.name);
