export type GameGenre =
  | "MOBA"
  | "FPS"
  | "SPORTS"
  | "BATTLE_ROYALE"
  | "CARD"
  | "OTHER";

export interface Game {
  id: string;
  name: string;
  iconUrl: string | null;
  genre: GameGenre;
  positions: string[] | null;
  defaultTeamSize: number;
  minTeamSize: number;
  maxTeamSize: number;
}

export type GameRef = Pick<Game, "id" | "name"> & Partial<Game>;
