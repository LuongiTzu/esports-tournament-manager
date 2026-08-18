export const DEFAULT_TOURNAMENT_BANNER_URL =
  "/images/home/hero/tournament-crowd.jpg";

export function getTournamentBannerUrl(bannerUrl?: string | null) {
  return bannerUrl?.trim() || DEFAULT_TOURNAMENT_BANNER_URL;
}
