import type {
  DeleteCommentResponse,
  TournamentComment,
  TournamentCommentsResponse,
} from "@/features/comments/types";
import { request } from "@/lib/api/client";

export const commentsApi = {
  findByTournament: (slug: string, page = 1, limit = 20) =>
    request<TournamentCommentsResponse>(
      `/tournaments/${encodeURIComponent(slug)}/comments?page=${page}&limit=${limit}`,
      { auth: true },
    ),
  create: (slug: string, content: string, replyToCommentId?: string) =>
    request<TournamentComment>(
      `/tournaments/${encodeURIComponent(slug)}/comments`,
      {
        method: "POST",
        auth: true,
        body: JSON.stringify({ content, replyToCommentId }),
      },
    ),
  hide: (commentId: string) =>
    request<TournamentComment>(
      `/comments/${encodeURIComponent(commentId)}/hide`,
      {
        method: "PATCH",
        auth: true,
      },
    ),
  remove: (commentId: string) =>
    request<DeleteCommentResponse>(
      `/comments/${encodeURIComponent(commentId)}`,
      {
        method: "DELETE",
        auth: true,
      },
    ),
};
