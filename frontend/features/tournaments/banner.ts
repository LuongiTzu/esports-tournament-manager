import { resolveImageUrl } from "@/lib/image-url";

export const DEFAULT_TOURNAMENT_BANNER_URL =
  "/images/tournaments/common/backgrounds/tournament-collage.png";

const GAME_POSTERS: Record<string, string> = {
  leagueoflegends: "/images/tournaments/common/posters/league-of-legends.jpg",
  lol: "/images/tournaments/common/posters/league-of-legends.jpg",
  lienquanmobile: "/images/tournaments/common/posters/arena-of-valor.jpg",
  arenaofvalor: "/images/tournaments/common/posters/arena-of-valor.jpg",
  aov: "/images/tournaments/common/posters/arena-of-valor.jpg",
  dota2: "/images/tournaments/common/posters/dota-2.jpg",
  valorant: "/images/tournaments/common/posters/valorant.jpg",
  csgo: "/images/tournaments/common/posters/counter-strike-2.jpg",
  counterstrike: "/images/tournaments/common/posters/counter-strike-2.jpg",
  counterstrike2: "/images/tournaments/common/posters/counter-strike-2.jpg",
  fconline: "/images/tournaments/common/posters/fc-online.jpg",
  fifaonline: "/images/tournaments/common/posters/fc-online.jpg",
};

function normalizeGameName(gameName: string) {
  return gameName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]/g, "");
}

export function getTournamentBannerUrl(
  bannerUrl?: string | null,
  gameName?: string | null,
) {
  const uploadedBanner = bannerUrl?.trim();
  if (uploadedBanner) {
    const resolvedBanner = resolveImageUrl(uploadedBanner);
    if (resolvedBanner) return resolvedBanner;
  }

  const gamePoster = gameName
    ? GAME_POSTERS[normalizeGameName(gameName)]
    : undefined;

  return gamePoster || DEFAULT_TOURNAMENT_BANNER_URL;
}
