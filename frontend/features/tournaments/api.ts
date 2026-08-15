import type {
  FindAllTournamentsParams,
  Paginated,
  Tournament,
  TournamentDetail,
} from "@/features/tournaments/types";
import { request } from "@/lib/api/client";

export const tournamentsApi = {
  findAll: (params: FindAllTournamentsParams = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.gameId) query.set("gameId", params.gameId);
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    const search = query.toString();
    return request<Paginated<Tournament>>(`/tournaments${search ? `?${search}` : ""}`);
  },
  findBySlug: (slug: string) =>
    request<TournamentDetail>(`/tournaments/slug/${slug}`, { auth: true }),
  create: (data: Record<string, unknown>) =>
    request<Tournament>("/tournaments", {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  addRound: (tournamentId: string, data: Record<string, unknown>) =>
    request<unknown>(`/tournaments/${tournamentId}/rounds`, {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  findMine: (tab: "organized" | "joined") =>
    request<Tournament[]>(`/users/me/tournaments?tab=${tab}`, { auth: true }),
};
