import { request } from "@/lib/api/client";
import type {
  MatchDetail,
  MatchMutationResult,
  PutMatchScoresRequest,
  UpdateMatchRequest,
} from "./types";

export const matchesApi = {
  findOne: (matchId: string) =>
    request<MatchDetail>(`/matches/${matchId}`, { auth: true }),
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
