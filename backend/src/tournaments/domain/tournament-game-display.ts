const CUSTOM_GAME_CODE = 'CUSTOM';
const CUSTOM_GAME_FALLBACK = 'Custom';

export interface TournamentGameDisplayFacts {
  customGameName?: string | null;
  game: {
    code: string;
    name: string;
  };
}

export function resolveTournamentGameDisplayName(
  facts: TournamentGameDisplayFacts,
): string {
  if (facts.game.code !== CUSTOM_GAME_CODE) return facts.game.name;
  return facts.customGameName?.trim() || CUSTOM_GAME_FALLBACK;
}

export function withTournamentGameDisplayName<
  T extends TournamentGameDisplayFacts,
>(tournament: T): T & { displayGameName: string } {
  return {
    ...tournament,
    displayGameName: resolveTournamentGameDisplayName(tournament),
  };
}
