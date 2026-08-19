export type GameGenre =
  | "MOBA"
  | "FPS"
  | "SPORTS"
  | "BATTLE_ROYALE"
  | "FIGHTING"
  | "CARD"
  | "OTHER";

export type GamePositionMode = "FIXED" | "OPTIONAL" | "NONE";

export interface Game {
  id: string;
  name: string;
  iconUrl: string | null;
  genre: GameGenre;
  positions: string[] | null;
  positionMode: GamePositionMode;
  defaultTeamSize: number;
  minTeamSize: number;
  maxTeamSize: number;
}

export type GameRef = Pick<Game, "id" | "name"> & Partial<Game>;
