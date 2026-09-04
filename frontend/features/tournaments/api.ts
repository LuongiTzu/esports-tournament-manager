import type {
  AdvanceRoundResult,
  CompetitionAuditLog,
  CreateTournamentRequest,
  CreateRoundRequest,
  DownstreamResetPreview,
  DownstreamResetResult,
  FinalizeTournamentStandingsResult,
  FindAllTournamentsParams,
  GenerateRoundResult,
  RoundGenerationPreview,
  GenerateSwissIterationResult,
  Paginated,
  Tournament,
  TournamentBracket,
  TournamentDetail,
  TournamentFavoriteMutationResult,
  TournamentMutationResult,
  TournamentStandingsResponse,
  UpdateTournamentLifecycleRequest,
  UpdateTournamentRequest,
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
      { auth: true },
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
  update: (tournamentId: string, data: UpdateTournamentRequest) =>
    request<TournamentMutationResult>(`/tournaments/${tournamentId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      auth: true,
    }),
  updateLifecycle: (
    tournamentId: string,
    data: UpdateTournamentLifecycleRequest,
  ) =>
    request<Tournament>(`/tournaments/${tournamentId}`, {
      method: "PATCH",
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
  previewRoundGeneration: (roundId: string, force = false) =>
    request<RoundGenerationPreview>(
      `/rounds/${roundId}/generate-preview${force ? "?force=true" : ""}`,
      { method: "POST", auth: true },
    ),
  generateRound: (roundId: string, force = false, previewToken?: string) =>
    request<GenerateRoundResult>(
      `/rounds/${roundId}/generate${force ? "?force=true" : ""}`,
      {
        method: "POST",
        body: JSON.stringify({ previewToken }),
        auth: true,
      },
    ),
  generateNextSwissIteration: (roundId: string) =>
    request<GenerateSwissIterationResult>(
      `/rounds/${roundId}/swiss/generate-next`,
      { method: "POST", auth: true },
    ),
  advanceRound: (roundId: string, qualifiedTeamIds?: string[]) =>
    request<AdvanceRoundResult>(`/rounds/${roundId}/advance`, {
      method: "POST",
      body: JSON.stringify({ qualifiedTeamIds }),
      auth: true,
    }),
  previewDownstreamReset: (roundId: string) =>
    request<DownstreamResetPreview>(
      `/rounds/${roundId}/reset-downstream-preview`,
      { method: "POST", auth: true },
    ),
  resetDownstream: (roundId: string, previewToken: string) =>
    request<DownstreamResetResult>(`/rounds/${roundId}/reset-downstream`, {
      method: "POST",
      body: JSON.stringify({ previewToken }),
      auth: true,
    }),
  finalizeStandings: (tournamentId: string, championTeamId?: string) =>
    request<FinalizeTournamentStandingsResult>(
      `/tournaments/${tournamentId}/finalize-standings`,
      {
        method: "POST",
        body: JSON.stringify({ championTeamId }),
        auth: true,
      },
    ),
  getCompetitionAudit: (tournamentId: string, page = 1, limit = 20) =>
    request<Paginated<CompetitionAuditLog>>(
      `/tournaments/${tournamentId}/competition-audit?page=${page}&limit=${limit}`,
      { auth: true },
    ),
  findMine: (tab: "organized" | "joined") =>
    request<Tournament[]>(`/users/me/tournaments?tab=${tab}`, { auth: true }),
  findFavorites: () =>
    request<Tournament[]>("/users/me/favorite-tournaments", { auth: true }),
  favorite: (slug: string) =>
    request<TournamentFavoriteMutationResult>(`/tournaments/${slug}/favorite`, {
      method: "POST",
      auth: true,
    }),
  unfavorite: (slug: string) =>
    request<TournamentFavoriteMutationResult>(`/tournaments/${slug}/favorite`, {
      method: "DELETE",
      auth: true,
    }),
};
