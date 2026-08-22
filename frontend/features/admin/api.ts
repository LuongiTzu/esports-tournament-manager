import { request } from "@/lib/api/client";
import type {
  AdminDashboardStats,
  AdminBannedKeyword,
  AdminComment,
  AdminCommentsQuery,
  AdminCommentVisibilityResult,
  AdminDeleteCommentResult,
  AdminDeleteKeywordResult,
  AdminReport,
  AdminReportReviewResult,
  AdminReportsQuery,
  AdminTournament,
  AdminTournamentModerationStatus,
  AdminTournamentMutationResult,
  AdminTournamentsQuery,
  AdminUserLockResult,
  AdminUsersQuery,
  AdminUsersResponse,
  CreateBannedKeywordRequest,
  UpdateBannedKeywordRequest,
} from "@/features/admin/types";

function reportsQueryString(query: AdminReportsQuery) {
  const params = new URLSearchParams();
  if (query.status) params.set("status", query.status);
  const value = params.toString();
  return value ? `?${value}` : "";
}

function commentsQueryString(query: AdminCommentsQuery) {
  const params = new URLSearchParams();
  if (query.search) params.set("search", query.search);
  if (query.isHidden !== undefined) {
    params.set("isHidden", String(query.isHidden));
  }
  const value = params.toString();
  return value ? `?${value}` : "";
}

function tournamentsQueryString(query: AdminTournamentsQuery) {
  const params = new URLSearchParams();
  if (query.moderationStatus) {
    params.set("moderationStatus", query.moderationStatus);
  }
  const value = params.toString();
  return value ? `?${value}` : "";
}

function usersQueryString(query: AdminUsersQuery) {
  const params = new URLSearchParams({
    page: String(query.page),
    limit: String(query.limit),
  });
  if (query.search) params.set("search", query.search);
  if (query.role) params.set("role", query.role);
  if (query.isLocked !== undefined) {
    params.set("isLocked", String(query.isLocked));
  }
  return params.toString();
}

export const adminApi = {
  getDashboardStats: () =>
    request<AdminDashboardStats>("/admin/stats", { auth: true }),
  listUsers: (query: AdminUsersQuery) =>
    request<AdminUsersResponse>(`/admin/users?${usersQueryString(query)}`, {
      auth: true,
    }),
  setUserLock: (userId: string, isLocked: boolean) =>
    request<AdminUserLockResult>(`/admin/users/${userId}/lock`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ isLocked }),
    }),
  listTournaments: (query: AdminTournamentsQuery = {}) =>
    request<AdminTournament[]>(
      `/admin/tournaments${tournamentsQueryString(query)}`,
      { auth: true },
    ),
  setTournamentVerification: (tournamentId: string, isVerified: boolean) =>
    request<AdminTournamentMutationResult>(
      `/admin/tournaments/${tournamentId}/verify`,
      {
        method: "PATCH",
        auth: true,
        body: JSON.stringify({ isVerified }),
      },
    ),
  setTournamentModeration: (
    tournamentId: string,
    moderationStatus: AdminTournamentModerationStatus,
    reason?: string,
  ) =>
    request<AdminTournamentMutationResult>(
      `/admin/tournaments/${tournamentId}/moderation`,
      {
        method: "PATCH",
        auth: true,
        body: JSON.stringify({ moderationStatus, ...(reason ? { reason } : {}) }),
      },
    ),
  listReports: (query: AdminReportsQuery = {}) =>
    request<AdminReport[]>(`/admin/reports${reportsQueryString(query)}`, {
      auth: true,
    }),
  reviewReport: (reportId: string, status: "REVIEWED" | "DISMISSED") =>
    request<AdminReportReviewResult>(`/admin/reports/${reportId}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify({ status }),
    }),
  listComments: (query: AdminCommentsQuery = {}) =>
    request<AdminComment[]>(`/admin/comments${commentsQueryString(query)}`, {
      auth: true,
    }),
  setCommentHidden: (commentId: string, isHidden: boolean) =>
    request<AdminCommentVisibilityResult>(
      `/admin/comments/${commentId}/${isHidden ? "hide" : "unhide"}`,
      { method: "PATCH", auth: true },
    ),
  deleteComment: (commentId: string) =>
    request<AdminDeleteCommentResult>(`/admin/comments/${commentId}`, {
      method: "DELETE",
      auth: true,
    }),
  listBannedKeywords: () =>
    request<AdminBannedKeyword[]>("/admin/banned-keywords", { auth: true }),
  createBannedKeyword: (body: CreateBannedKeywordRequest) =>
    request<AdminBannedKeyword>("/admin/banned-keywords", {
      method: "POST",
      auth: true,
      body: JSON.stringify(body),
    }),
  updateBannedKeyword: (keywordId: string, body: UpdateBannedKeywordRequest) =>
    request<AdminBannedKeyword>(`/admin/banned-keywords/${keywordId}`, {
      method: "PATCH",
      auth: true,
      body: JSON.stringify(body),
    }),
  deleteBannedKeyword: (keywordId: string) =>
    request<AdminDeleteKeywordResult>(`/admin/banned-keywords/${keywordId}`, {
      method: "DELETE",
      auth: true,
    }),
};
