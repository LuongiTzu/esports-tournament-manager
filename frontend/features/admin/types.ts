import type { User } from "@/features/auth/types";
import type {
  TournamentMode,
  TournamentVisibility,
} from "@/features/tournaments/types";
import type { Gender } from "@/shared/types/gender";
import type { Paginated } from "@/shared/types/pagination";
import type { TournamentStatus } from "@/shared/types/tournament-status";

export interface AdminDashboardStats {
  totalTournaments: number;
  totalUsers: number;
  tournamentsBeingReported: number;
  lockedTournaments: number;
  lockedAccounts: number;
  tournamentsCreatedLast7Days: number;
}

export type AdminUserRole = User["role"];

export interface AdminUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  role: AdminUserRole;
  isLocked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AdminUsersQuery {
  page: number;
  limit: number;
  search?: string;
  role?: AdminUserRole;
  isLocked?: boolean;
}

export type AdminUsersResponse = Paginated<AdminUser>;

export type AdminUserLockResult = Pick<
  AdminUser,
  "id" | "email" | "displayName" | "role" | "isLocked" | "updatedAt"
>;

export type AdminTournamentStatus = TournamentStatus;
export type AdminTournamentVisibility = TournamentVisibility;
export type AdminTournamentMode = TournamentMode;
export type AdminTournamentModerationStatus = "ACTIVE" | "HIDDEN_BY_ADMIN";

export interface AdminTournament {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  rules: string | null;
  bannerUrl: string | null;
  visibility: AdminTournamentVisibility;
  moderationStatus: AdminTournamentModerationStatus;
  isVerified: boolean;
  registrationOpen: boolean;
  maxTeams: number | null;
  startDate: string | null;
  endDate: string | null;
  status: AdminTournamentStatus;
  mode: AdminTournamentMode;
  location: string | null;
  minTeamSize: number;
  maxTeamSize: number;
  minAge: number | null;
  maxAge: number | null;
  allowedGenders: Gender[] | null;
  registrationStartDate: string | null;
  registrationDeadline: string | null;
  autoApproveTeams: boolean;
  requireMemberFullInfo: boolean;
  prizePool: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  contactLink: string | null;
  createdAt: string;
  updatedAt: string;
  gameId: string;
  customGameName: string | null;
  displayGameName: string;
  organizerId: string;
  organizer: { id: string; displayName: string; email: string };
  game: { id: string; code: string; name: string };
  _count: { reports: number };
}

export interface AdminTournamentsQuery {
  moderationStatus?: AdminTournamentModerationStatus;
}

export type AdminTournamentMutationResult = Pick<
  AdminTournament,
  "id" | "moderationStatus" | "isVerified" | "updatedAt"
>;

export type AdminReportStatus = "PENDING" | "REVIEWED" | "DISMISSED";
export type AdminReportReason =
  | "GAMBLING"
  | "MINOR_SAFETY"
  | "HARASSMENT_OR_HATE"
  | "VIOLENCE_OR_SELF_HARM"
  | "RESTRICTED_GOODS"
  | "ADULT_CONTENT"
  | "SCAM"
  | "INTELLECTUAL_PROPERTY"
  | "SPAM_OR_MALICIOUS_LINKS"
  | "INAPPROPRIATE_CONTENT"
  | "OTHER";

export interface AdminReport {
  id: string;
  reason: AdminReportReason;
  description: string | null;
  status: AdminReportStatus;
  createdAt: string;
  reviewedAt: string | null;
  tournamentId: string;
  reporterUserId: string | null;
  reviewedBy: string | null;
  tournament: { id: string; name: string; slug: string };
  reporter: { id: string; displayName: string } | null;
  reviewer: { id: string; displayName: string } | null;
}

export interface AdminReportsQuery {
  status?: AdminReportStatus;
}

export type AdminReportReviewResult = Pick<
  AdminReport,
  "id" | "status" | "reviewedAt" | "reviewedBy"
>;

export interface AdminComment {
  id: string;
  content: string;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
  authorId: string;
  tournamentId: string;
  author: { id: string; displayName: string };
  tournament: { id: string; name: string; slug: string };
}

export interface AdminCommentsQuery {
  isHidden?: boolean;
  search?: string;
}

export type AdminCommentVisibilityResult = Pick<
  AdminComment,
  "id" | "isHidden" | "updatedAt"
>;

export interface AdminDeleteCommentResult {
  message: string;
  id: string;
}

export type BannedKeywordCategory =
  | "GAMBLING"
  | "PROFANITY"
  | "MALICIOUS_LINK";

export interface AdminBannedKeyword {
  id: string;
  keyword: string;
  category: BannedKeywordCategory;
  createdAt: string;
}

export interface CreateBannedKeywordRequest {
  keyword: string;
  category: BannedKeywordCategory;
}

export interface UpdateBannedKeywordRequest {
  keyword?: string;
  category?: BannedKeywordCategory;
}

export interface AdminDeleteKeywordResult {
  message: string;
  id: string;
}
