export const TOURNAMENT_GAME_SELECT = {
  id: true,
  code: true,
  name: true,
  iconUrl: true,
  genre: true,
  positions: true,
  positionMode: true,
  teamSizeMode: true,
  defaultTeamSize: true,
  minTeamSize: true,
  maxTeamSize: true,
  allowedTeamSizes: true,
  minSelectableTeamSize: true,
  maxSelectableTeamSize: true,
} as const;

export const PUBLIC_TOURNAMENT_TEAM_SELECT = {
  id: true,
  name: true,
  shortName: true,
  logoUrl: true,
  seed: true,
} as const;
