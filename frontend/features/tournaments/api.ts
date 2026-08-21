import type {
  CreateTournamentRequest,
  CreateRoundRequest,
  FindAllTournamentsParams,
  GenerateRoundResult,
  GenerateSwissIterationResult,
  Paginated,
  Tournament,
  TournamentBracket,
  TournamentDetail,
  TournamentStandingsResponse,
} from "@/features/tournaments/types";
import { request } from "@/lib/api/client";
import { uploadImage } from "@/lib/api/upload";

export const tournamentsApi = {
  findAll: (params: FindAllTournamentsParams = {}) => {
    const query = new URLSearchParams();
    if (params.search) query.set("search", params.search);
    if (params.gameId) query.set("gameId", params.gameId);
    if (params.status) query.set("status", params.status);
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    const search = query.toString();
    return request<Paginated<Tournament>>(
      `/tournaments${search ? `?${search}` : ""}`,
    );
  },
  findBySlug: (slug: string) =>
    request<TournamentDetail>(`/tournaments/slug/${slug}`, { auth: true }),
  create: (data: CreateTournamentRequest) =>
    request<Tournament>("/tournaments", {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  uploadBanner: (tournamentId: string, file: File) =>
    uploadImage(`/tournaments/${tournamentId}/banner`, file),
  addRound: (tournamentId: string, data: CreateRoundRequest) =>
    request<unknown>(`/tournaments/${tournamentId}/rounds`, {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  getTournamentBracket: (slug: string) =>
    request<TournamentBracket>(`/tournaments/${slug}/bracket`, { auth: true }),
  getStandings: (slug: string) =>
    request<TournamentStandingsResponse>(`/tournaments/${slug}/standings`, {
      auth: true,
    }),
  generateRound: (roundId: string, force = false) =>
    request<GenerateRoundResult>(
      `/rounds/${roundId}/generate${force ? "?force=true" : ""}`,
      { method: "POST", auth: true },
    ),
  generateNextSwissIteration: (roundId: string) =>
    request<GenerateSwissIterationResult>(
      `/rounds/${roundId}/swiss/generate-next`,
      { method: "POST", auth: true },
    ),
  findMine: (tab: "organized" | "joined") =>
    request<Tournament[]>(`/users/me/tournaments?tab=${tab}`, { auth: true }),
};
