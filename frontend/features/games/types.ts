export type GameGenre =
  | "MOBA"
  | "FPS"
  | "SPORTS"
  | "BATTLE_ROYALE"
  | "FIGHTING"
  | "CARD"
  | "OTHER";

export type GamePositionMode = "FIXED" | "OPTIONAL" | "NONE";
export type TeamSizeMode = "FIXED" | "PRESET" | "FLEXIBLE";

export interface Game {
  id: string;
  code: string;
  name: string;
  iconUrl: string | null;
  genre: GameGenre;
  positions: string[] | null;
  positionMode: GamePositionMode;
  teamSizeMode: TeamSizeMode;
  defaultTeamSize: number;
  minTeamSize: number;
  maxTeamSize: number;
  allowedTeamSizes: number[];
  minSelectableTeamSize: number | null;
  maxSelectableTeamSize: number | null;
}

export type GameRef = Pick<Game, "id" | "name"> & Partial<Game>;
