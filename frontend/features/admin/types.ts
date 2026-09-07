import type { User } from "@/features/auth/types";
import type {
  TournamentMode,
  TournamentVisibility,
} from "@/features/tournaments/types";
import type { Gender } from "@/shared/types/gender";
import type { Paginated } from "@/shared/types/pagination";
import type { TournamentStatus } from "@/shared/types/tournament-status";

export interface AdminDashboardStats {
  periodDays: AdminDashboardPeriod;
  totalTournaments: number;
  totalUsers: number;
  newUsers: number;
  userGrowthPercent: number | null;
  ongoingTournaments: number;
  officialTournaments: number;
  newTournaments: number;
  tournamentGrowthPercent: number | null;
  totalMatches: number;
  matchesToday: number;
  pendingReports: number;
  tournamentsWithPendingReports: number;
  hiddenTournaments: number;
  dailyGrowth: AdminDailyGrowthPoint[];
  tournamentStatusDistribution: AdminTournamentStatusCount[];
  topGames: AdminPopularGame[];
  recentReports: AdminDashboardReport[];
  recentTournaments: AdminDashboardTournament[];
  /** Backward-compatible aliases returned by the current endpoint. */
  tournamentsBeingReported: number;
  lockedTournaments: number;
  lockedAccounts: number;
  tournamentsCreatedLast7Days: number;
}

export type AdminDashboardPeriod = 7 | 30;

export interface AdminDailyGrowthPoint {
  date: string;
  newUsers: number;
  newTournaments: number;
}

export interface AdminTournamentStatusCount {
  status: TournamentStatus;
  count: number;
}

export interface AdminPopularGame {
  gameId: string;
  displayGameName: string;
  tournamentCount: number;
}

export interface AdminDashboardReport {
  id: string;
  reason: AdminReportReason;
  status: AdminReportStatus;
  createdAt: string;
  tournament: { id: string; name: string; slug: string };
  reporter: { id: string; displayName: string } | null;
}

export interface AdminDashboardTournament {
  id: string;
  name: string;
  slug: string;
  bannerUrl: string | null;
  status: TournamentStatus;
  isOfficial: boolean;
  createdAt: string;
  customGameName: string | null;
  displayGameName: string;
  organizer: { id: string; displayName: string };
  game: { id: string; code: string; name: string };
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

export interface AdminTournamentOverride {
  id: string;
  reason: string;
  status: "ACTIVE" | "ENDED";
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;
  tournamentId: string;
  adminId: string;
  admin: { id: string; displayName: string; email: string };
}

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
  isOfficial: boolean;
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
  organizer: {
    id: string;
    displayName: string;
    email: string;
    role: AdminUserRole;
  };
  game: { id: string; code: string; name: string };
  _count: { reports: number };
  activeAdminOverride: AdminTournamentOverride | null;
}

export interface AdminTournamentsQuery {
  search?: string;
  gameId?: string;
  status?: AdminTournamentStatus;
  moderationStatus?: AdminTournamentModerationStatus;
}

export type AdminTournamentMutationResult = Pick<
  AdminTournament,
  "id" | "moderationStatus" | "isVerified" | "isOfficial" | "updatedAt"
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

export type BannedKeywordCategory = "GAMBLING" | "PROFANITY" | "MALICIOUS_LINK";

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
