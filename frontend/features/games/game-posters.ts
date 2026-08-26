const POSTER_ROOT = "/images/tournaments/common/posters";

export const GAME_POSTERS: Readonly<Record<string, string>> = {
  LIEN_QUAN_MOBILE: `${POSTER_ROOT}/arena-of-valor.jpg`,
  LEAGUE_OF_LEGENDS: `${POSTER_ROOT}/league-of-legends.jpg`,
  VALORANT: `${POSTER_ROOT}/valorant.jpg`,
  COUNTER_STRIKE_2: `${POSTER_ROOT}/counter-strike-2.jpg`,
  DOTA_2: `${POSTER_ROOT}/dota-2.jpg`,
  ROCKET_LEAGUE: `${POSTER_ROOT}/rocket-league.jpg`,
  TEKKEN_8: `${POSTER_ROOT}/tenken.jpg`,
  STREET_FIGHTER_6: `${POSTER_ROOT}/street-fighter.jpg`,
  MLBB: `${POSTER_ROOT}/mobile legend.jpg`,
  HONOR_OF_KINGS: `${POSTER_ROOT}/honor-of-king.jpg`,
  WILD_RIFT: `${POSTER_ROOT}/wild-rift.jpg`,
  FC_ONLINE: `${POSTER_ROOT}/fc-online.jpg`,
  CROSSFIRE_PC: `${POSTER_ROOT}/crossfire.jpg`,
  POKEMON_UNITE: `${POSTER_ROOT}/pokemon-unite.jpg`,
  CUSTOM: "/images/tournaments/common/backgrounds/tournament-collage.png",
};

export function gamePoster(code: string): string | undefined {
  return GAME_POSTERS[code];
}
