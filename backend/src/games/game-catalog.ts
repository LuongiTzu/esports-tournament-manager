import { GameGenre, GamePositionMode, TeamSizeMode } from '@prisma/client';

const STANDARD_ROSTER_CAP = 10;
const ICON_ROOT = '/images/games/icons';

export interface GameCatalogEntry {
  code: string;
  name: string;
  iconUrl: string | null;
  genre: GameGenre;
  positions: string[];
  positionMode: GamePositionMode;
  teamSizeMode: TeamSizeMode;
  defaultTeamSize: number;
  minTeamSize: number;
  maxTeamSize: number;
  allowedTeamSizes: number[];
  minSelectableTeamSize: number | null;
  maxSelectableTeamSize: number | null;
}

const fixedGame = (
  game: Omit<
    GameCatalogEntry,
    | 'teamSizeMode'
    | 'allowedTeamSizes'
    | 'minSelectableTeamSize'
    | 'maxSelectableTeamSize'
  >,
): GameCatalogEntry => ({
  ...game,
  teamSizeMode: TeamSizeMode.FIXED,
  allowedTeamSizes: [],
  minSelectableTeamSize: null,
  maxSelectableTeamSize: null,
});

export const GAME_CATALOG: GameCatalogEntry[] = [
  fixedGame({
    code: 'LEAGUE_OF_LEGENDS',
    name: 'League of Legends',
    iconUrl: `${ICON_ROOT}/league-of-legends.svg`,
    genre: GameGenre.MOBA,
    positions: ['TOP', 'JUNGLE', 'MID', 'BOT', 'SUPPORT'],
    positionMode: GamePositionMode.FIXED,
    defaultTeamSize: 5,
    minTeamSize: 5,
    maxTeamSize: STANDARD_ROSTER_CAP,
  }),
  fixedGame({
    code: 'LIEN_QUAN_MOBILE',
    name: 'Liên Quân Mobile',
    iconUrl: `${ICON_ROOT}/lien-quan-mobile.svg`,
    genre: GameGenre.MOBA,
    positions: ['DARK_SLAYER_LANE', 'JUNGLE', 'MID', 'DRAGON_LANE', 'ROAM'],
    positionMode: GamePositionMode.FIXED,
    defaultTeamSize: 5,
    minTeamSize: 5,
    maxTeamSize: STANDARD_ROSTER_CAP,
  }),
  fixedGame({
    code: 'VALORANT',
    name: 'Valorant',
    iconUrl: `${ICON_ROOT}/valorant.svg`,
    genre: GameGenre.FPS,
    positions: ['DUELIST', 'INITIATOR', 'CONTROLLER', 'SENTINEL'],
    positionMode: GamePositionMode.OPTIONAL,
    defaultTeamSize: 5,
    minTeamSize: 5,
    maxTeamSize: STANDARD_ROSTER_CAP,
  }),
  fixedGame({
    code: 'COUNTER_STRIKE_2',
    name: 'Counter-Strike 2',
    iconUrl: `${ICON_ROOT}/counter-strike-2.svg`,
    genre: GameGenre.FPS,
    positions: [],
    positionMode: GamePositionMode.NONE,
    defaultTeamSize: 5,
    minTeamSize: 5,
    maxTeamSize: STANDARD_ROSTER_CAP,
  }),
  fixedGame({
    code: 'DOTA_2',
    name: 'Dota 2',
    iconUrl: `${ICON_ROOT}/dota-2.svg`,
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
    maxTeamSize: STANDARD_ROSTER_CAP,
  }),
  fixedGame({
    code: 'ROCKET_LEAGUE',
    name: 'Rocket League',
    iconUrl: `${ICON_ROOT}/rocket-league.svg`,
    genre: GameGenre.SPORTS,
    positions: [],
    positionMode: GamePositionMode.NONE,
    defaultTeamSize: 3,
    minTeamSize: 3,
    maxTeamSize: STANDARD_ROSTER_CAP,
  }),
  fixedGame({
    code: 'TEKKEN_8',
    name: 'Tekken 8',
    iconUrl: `${ICON_ROOT}/tekken-8.svg`,
    genre: GameGenre.FIGHTING,
    positions: [],
    positionMode: GamePositionMode.NONE,
    defaultTeamSize: 1,
    minTeamSize: 1,
    maxTeamSize: STANDARD_ROSTER_CAP,
  }),
  fixedGame({
    code: 'STREET_FIGHTER_6',
    name: 'Street Fighter 6',
    iconUrl: `${ICON_ROOT}/street-fighter-6.svg`,
    genre: GameGenre.FIGHTING,
    positions: [],
    positionMode: GamePositionMode.NONE,
    defaultTeamSize: 1,
    minTeamSize: 1,
    maxTeamSize: STANDARD_ROSTER_CAP,
  }),
  fixedGame({
    code: 'MLBB',
    name: 'Mobile Legends: Bang Bang',
    iconUrl: `${ICON_ROOT}/mobile-legends.svg`,
    genre: GameGenre.MOBA,
    positions: ['EXP_LANE', 'JUNGLE', 'MID_LANE', 'GOLD_LANE', 'ROAM'],
    positionMode: GamePositionMode.FIXED,
    defaultTeamSize: 5,
    minTeamSize: 5,
    maxTeamSize: STANDARD_ROSTER_CAP,
  }),
  fixedGame({
    code: 'HONOR_OF_KINGS',
    name: 'Honor of Kings',
    iconUrl: `${ICON_ROOT}/honor-of-kings.svg`,
    genre: GameGenre.MOBA,
    positions: ['CLASH_LANE', 'JUNGLE', 'MID_LANE', 'FARM_LANE', 'ROAM'],
    positionMode: GamePositionMode.FIXED,
    defaultTeamSize: 5,
    minTeamSize: 5,
    maxTeamSize: STANDARD_ROSTER_CAP,
  }),
  fixedGame({
    code: 'WILD_RIFT',
    name: 'League of Legends: Wild Rift',
    iconUrl: `${ICON_ROOT}/wild-rift.svg`,
    genre: GameGenre.MOBA,
    positions: ['SOLO_LANE', 'JUNGLE', 'MID_LANE', 'DUO_LANE', 'SUPPORT'],
    positionMode: GamePositionMode.FIXED,
    defaultTeamSize: 5,
    minTeamSize: 5,
    maxTeamSize: STANDARD_ROSTER_CAP,
  }),
  {
    code: 'FC_ONLINE',
    name: 'FC Online',
    iconUrl: `${ICON_ROOT}/fc-online.ico`,
    genre: GameGenre.SPORTS,
    positions: [],
    positionMode: GamePositionMode.NONE,
    teamSizeMode: TeamSizeMode.PRESET,
    defaultTeamSize: 3,
    minTeamSize: 1,
    maxTeamSize: STANDARD_ROSTER_CAP,
    allowedTeamSizes: [1, 3],
    minSelectableTeamSize: null,
    maxSelectableTeamSize: null,
  },
  fixedGame({
    code: 'CROSSFIRE_PC',
    name: 'CrossFire',
    iconUrl: `${ICON_ROOT}/crossfire.svg`,
    genre: GameGenre.FPS,
    positions: ['ORDER', 'ATTACKER', 'SNIPER', 'TACTICAL_BACKUP'],
    positionMode: GamePositionMode.OPTIONAL,
    defaultTeamSize: 5,
    minTeamSize: 5,
    maxTeamSize: STANDARD_ROSTER_CAP,
  }),
  {
    code: 'CUSTOM',
    name: 'Custom Game',
    iconUrl: null,
    genre: GameGenre.OTHER,
    positions: [],
    positionMode: GamePositionMode.NONE,
    teamSizeMode: TeamSizeMode.FLEXIBLE,
    defaultTeamSize: 1,
    minTeamSize: 1,
    maxTeamSize: 30,
    allowedTeamSizes: [],
    minSelectableTeamSize: 1,
    maxSelectableTeamSize: 20,
  },
];

export function assertValidGameCatalogEntry(game: GameCatalogEntry): void {
  const prefix = `Invalid game catalog entry ${game.code}:`;
  const isPositiveInteger = (value: number) =>
    Number.isInteger(value) && value > 0;

  if (
    !isPositiveInteger(game.defaultTeamSize) ||
    !isPositiveInteger(game.minTeamSize) ||
    !isPositiveInteger(game.maxTeamSize) ||
    game.minTeamSize > game.defaultTeamSize ||
    game.defaultTeamSize > game.maxTeamSize
  ) {
    throw new Error(`${prefix} invalid roster bounds`);
  }

  const hasFlexibleBounds =
    game.minSelectableTeamSize !== null || game.maxSelectableTeamSize !== null;

  if (game.teamSizeMode === TeamSizeMode.FIXED) {
    if (game.allowedTeamSizes.length > 0 || hasFlexibleBounds) {
      throw new Error(`${prefix} FIXED metadata is inconsistent`);
    }
    return;
  }

  if (game.teamSizeMode === TeamSizeMode.PRESET) {
    const sizes = game.allowedTeamSizes;
    const normalized = [...new Set(sizes)].sort((left, right) => left - right);
    if (
      sizes.length === 0 ||
      sizes.some(
        (size, index) => !isPositiveInteger(size) || size !== normalized[index],
      ) ||
      !sizes.includes(game.defaultTeamSize) ||
      sizes.some((size) => size > game.maxTeamSize) ||
      hasFlexibleBounds
    ) {
      throw new Error(`${prefix} PRESET metadata is inconsistent`);
    }
    return;
  }

  const selectableMin = game.minSelectableTeamSize;
  const selectableMax = game.maxSelectableTeamSize;
  if (
    game.allowedTeamSizes.length > 0 ||
    selectableMin === null ||
    selectableMax === null ||
    !isPositiveInteger(selectableMin) ||
    !isPositiveInteger(selectableMax) ||
    selectableMin > game.defaultTeamSize ||
    game.defaultTeamSize > selectableMax ||
    selectableMax > game.maxTeamSize
  ) {
    throw new Error(`${prefix} FLEXIBLE metadata is inconsistent`);
  }
}

GAME_CATALOG.forEach(assertValidGameCatalogEntry);

export const GAME_CATALOG_CODES = GAME_CATALOG.map((game) => game.code);
export const GAME_CATALOG_NAMES = GAME_CATALOG.map((game) => game.name);
