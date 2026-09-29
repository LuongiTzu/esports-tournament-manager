import "server-only";

import { cache } from "react";
import type { Paginated, Tournament, TournamentDetail } from "./types";
import { ServerApiError, serverRequest } from "@/lib/api/server";

export const getPublicTournament = cache(async (slug: string) => {
  try {
    return await serverRequest<TournamentDetail>(
      `/tournaments/slug/${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    );
  } catch (error) {
    if (error instanceof ServerApiError && error.status === 404) return null;
    throw error;
  }
});

export async function getPublicTournamentSitemapPage(page: number) {
  return serverRequest<Paginated<Tournament>>(
    `/tournaments?sort=newest&limit=100&page=${page}`,
    { next: { revalidate: 3600, tags: ["public-tournaments"] } },
  );
}
