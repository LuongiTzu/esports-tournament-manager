export const DEFAULT_TOURNAMENT_BANNER_URL =
  "/images/tournaments/original_tournament.png";

const GAME_POSTERS: Record<string, string> = {
  leagueoflegends: "/images/tournaments/poster_lol.jpg",
  lol: "/images/tournaments/poster_lol.jpg",
  lienquanmobile: "/images/tournaments/poster_aov.jpg",
  arenaofvalor: "/images/tournaments/poster_aov.jpg",
  aov: "/images/tournaments/poster_aov.jpg",
  dota2: "/images/tournaments/poster_dota2.jpg",
  valorant: "/images/tournaments/poster_vlr.jpg",
  csgo: "/images/tournaments/poster_cs2.jpg",
  counterstrike: "/images/tournaments/poster_cs2.jpg",
  counterstrike2: "/images/tournaments/poster_cs2.jpg",
  fconline: "/images/tournaments/poster_fco.jpg",
  fifaonline: "/images/tournaments/poster_fco.jpg",
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
  if (uploadedBanner) return uploadedBanner;

  const gamePoster = gameName
    ? GAME_POSTERS[normalizeGameName(gameName)]
    : undefined;

  return gamePoster || DEFAULT_TOURNAMENT_BANNER_URL;
}
