import { request } from "@/lib/api/client";
import type {
  MatchDetail,
  MatchCheckIn,
  MatchMutationResult,
  MatchResultReview,
  MyMatchesResponse,
  PutMatchScoresRequest,
  RespondToMatchResultRequest,
  UpdateMatchRequest,
} from "./types";

export interface MyMatchFilters {
  gameId?: string;
  tournamentId?: string;
  teamId?: string;
  search?: string;
  attention?: "NEEDS_ACTION" | "CHECK_IN" | "CONFIRM" | "DISPUTED";
  sort?: "DEFAULT" | "NEWEST" | "OLDEST";
  from?: string;
  to?: string;
}

export const matchesApi = {
  checkIn: (matchId: string, teamId: string) =>
    request<MatchCheckIn>(`/matches/${encodeURIComponent(matchId)}/check-ins`, {
      method: "POST",
      body: JSON.stringify({ teamId }),
      auth: true,
    }),
  findMine: (
    params: MyMatchFilters & {
      status?: MatchDetail["status"];
      page?: number;
      limit?: number;
    } = {},
  ) => {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.page) query.set("page", String(params.page));
    if (params.limit) query.set("limit", String(params.limit));
    for (const key of [
      "gameId",
      "tournamentId",
      "teamId",
      "search",
      "attention",
      "sort",
      "from",
      "to",
    ] as const) {
      if (params[key]) query.set(key, params[key]);
    }
    const search = query.toString();
    return request<MyMatchesResponse>(
      `/users/me/matches${search ? `?${search}` : ""}`,
      { auth: true },
    );
  },
  findOne: (matchId: string) =>
    request<MatchDetail>(`/matches/${matchId}`, { auth: true }),
  findResultReview: (matchId: string) =>
    request<MatchResultReview | null>(
      `/matches/${encodeURIComponent(matchId)}/result-review`,
      { auth: true },
    ),
  respondToResult: (matchId: string, data: RespondToMatchResultRequest) =>
    request<MatchResultReview>(
      `/matches/${encodeURIComponent(matchId)}/result-review/responses`,
      {
        method: "POST",
        body: JSON.stringify(data),
        auth: true,
      },
    ),
  resolveResultDispute: (matchId: string, resolutionNote: string) =>
    request<MatchResultReview>(
      `/matches/${encodeURIComponent(matchId)}/result-review/resolve`,
      {
        method: "PATCH",
        body: JSON.stringify({ resolutionNote }),
        auth: true,
      },
    ),
  update: (matchId: string, data: UpdateMatchRequest) =>
    request<MatchMutationResult>(`/matches/${matchId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
      auth: true,
    }),
  putScores: (matchId: string, data: PutMatchScoresRequest) =>
    request<MatchMutationResult>(`/matches/${matchId}/scores`, {
      method: "PUT",
      body: JSON.stringify(data),
      auth: true,
    }),
};
