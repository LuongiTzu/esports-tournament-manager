import type { GameRef } from "./types";

const ICON_ROOT = "/images/games/icons";

// Local artwork keeps catalog icons available when the API returns iconUrl: null.
// Sources and attribution: public/images/games/icons/README.md.
const GAME_ICONS = [
  {
    code: "COUNTER_STRIKE_2",
    name: "Counter-Strike 2",
    file: "counter-strike-2.svg",
  },
  { code: "CROSSFIRE_PC", name: "CrossFire", file: "crossfire.svg" },
  { code: "DOTA_2", name: "Dota 2", file: "dota-2.svg" },
  { code: "FC_ONLINE", name: "FC Online", file: "fc-online.ico" },
  {
    code: "HONOR_OF_KINGS",
    name: "Honor of Kings",
    file: "honor-of-kings.svg",
  },
  {
    code: "LEAGUE_OF_LEGENDS",
    name: "League of Legends",
    file: "league-of-legends.svg",
  },
  {
    code: "WILD_RIFT",
    name: "League of Legends: Wild Rift",
    file: "wild-rift.svg",
  },
  {
    code: "LIEN_QUAN_MOBILE",
    name: "Liên Quân Mobile",
    file: "lien-quan-mobile.svg",
  },
  {
    code: "MLBB",
    name: "Mobile Legends: Bang Bang",
    file: "mobile-legends.svg",
  },
  { code: "POKEMON_UNITE", name: "Pokémon UNITE", file: "pokemon-unite.svg" },
  { code: "ROCKET_LEAGUE", name: "Rocket League", file: "rocket-league.svg" },
  {
    code: "STREET_FIGHTER_6",
    name: "Street Fighter 6",
    file: "street-fighter-6.svg",
  },
  { code: "TEKKEN_8", name: "Tekken 8", file: "tekken-8.svg" },
  { code: "VALORANT", name: "Valorant", file: "valorant.svg" },
] as const;

export function gameIcon(game?: Pick<GameRef, "code" | "name"> | null) {
  if (!game || game.code === "CUSTOM") return undefined;
  const icon = GAME_ICONS.find((item) =>
    game.code
      ? item.code === game.code
      : item.name.toLowerCase() === game.name.trim().toLowerCase(),
  );
  return icon ? { code: icon.code, src: `${ICON_ROOT}/${icon.file}` } : undefined;
}
