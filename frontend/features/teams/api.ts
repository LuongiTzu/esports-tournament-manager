import type {
  MyTeam,
  TeamRegistration,
  TeamRegistrationForm,
  TeamDetail,
  TeamStatus,
  TeamWithMembers,
  TeamInvitation,
  TeamInvitationPreview,
  UpdateTeamStatusRequest,
} from "@/features/teams/types";
import { request } from "@/lib/api/client";
import { uploadImage } from "@/lib/api/upload";

export const teamsApi = {
  getRegistrationForm: (slug: string) =>
    request<TeamRegistrationForm>(`/tournaments/${slug}/registration-form`, {
      auth: true,
    }),
  getManualRegistrationForm: (slug: string) =>
    request<TeamRegistrationForm>(`/tournaments/${slug}/manual-team-form`, {
      auth: true,
    }),
  findByTournament: (slug: string, status?: "ALL" | TeamStatus) =>
    request<TeamWithMembers[]>(
      `/tournaments/${slug}/teams${status ? `?status=${status}` : ""}`,
      { auth: true },
    ),
  findOne: (teamId: string) =>
    request<TeamDetail>(`/teams/${teamId}`, { auth: true }),
  findMine: () => request<MyTeam[]>("/users/me/teams", { auth: true }),
  register: (slug: string, data: TeamRegistration) =>
    request<TeamWithMembers>(`/tournaments/${slug}/register`, {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  addManual: (slug: string, data: TeamRegistration) =>
    request<TeamWithMembers>(`/tournaments/${slug}/teams`, {
      method: "POST",
      body: JSON.stringify(data),
      auth: true,
    }),
  listInvitations: (slug: string) =>
    request<TeamInvitation[]>(`/tournaments/${slug}/team-invitations`, {
      auth: true,
    }),
  inviteTeam: (slug: string, email: string) =>
    request<{ id: string; email: string; expiresAt: string }>(
      `/tournaments/${slug}/team-invitations`,
      {
        method: "POST",
        body: JSON.stringify({ email }),
        auth: true,
      },
    ),
  previewInvitation: (token: string) =>
    request<TeamInvitationPreview>(
      `/team-invitations/preview?token=${encodeURIComponent(token)}`,
    ),
  getInvitationRegistrationForm: (token: string) =>
    request<TeamRegistrationForm>(
      `/team-invitations/registration-form?token=${encodeURIComponent(token)}`,
      { auth: true },
    ),
  acceptTeamInvitation: (token: string, team: TeamRegistration) =>
    request<TeamWithMembers>("/team-invitations/accept", {
      method: "POST",
      body: JSON.stringify({ token, team }),
      auth: true,
    }),
  acceptAccountLinkInvitation: (token: string) =>
    request<{ tournamentSlug: string; teamId: string }>(
      "/team-invitations/accept-account-link",
      {
        method: "POST",
        body: JSON.stringify({ token }),
        auth: true,
      },
    ),
  revokeInvitation: (invitationId: string) =>
    request<unknown>(`/team-invitations/${invitationId}`, {
      method: "DELETE",
      auth: true,
    }),
  inviteMember: (teamId: string, memberId: string) =>
    request<{ id: string; email: string; expiresAt: string }>(
      `/teams/${teamId}/members/${memberId}/invitation`,
      { method: "POST", auth: true },
    ),
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
