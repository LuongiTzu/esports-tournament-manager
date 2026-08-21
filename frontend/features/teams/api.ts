import type {
  MyTeam,
  TeamRegistration,
  TeamRegistrationForm,
  TeamStatus,
  TeamWithMembers,
  UpdateTeamStatusRequest,
} from "@/features/teams/types";
import { request } from "@/lib/api/client";
import { uploadImage } from "@/lib/api/upload";

export const teamsApi = {
  getRegistrationForm: (slug: string) =>
    request<TeamRegistrationForm>(`/tournaments/${slug}/registration-form`, {
      auth: true,
    }),
  findByTournament: (slug: string, status?: "ALL" | TeamStatus) =>
    request<TeamWithMembers[]>(
      `/tournaments/${slug}/teams${status ? `?status=${status}` : ""}`,
      { auth: true },
    ),
  findMine: () => request<MyTeam[]>("/users/me/teams", { auth: true }),
  register: (slug: string, data: TeamRegistration) =>
    request<TeamWithMembers>(`/tournaments/${slug}/register`, {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  uploadLogo: (teamId: string, file: File) =>
    uploadImage(`/teams/${teamId}/logo`, file),
  uploadMemberAvatar: (teamId: string, memberId: string, file: File) =>
    uploadImage(`/teams/${teamId}/members/${memberId}/avatar`, file),
  updateStatus: (teamId: string, data: UpdateTeamStatusRequest) =>
    request<TeamWithMembers>(`/teams/${teamId}/status`, {
      method: "PATCH",
      body: JSON.stringify(data),
      auth: true,
    }),
};
