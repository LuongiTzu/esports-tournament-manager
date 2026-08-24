import type { GameGenre, GamePositionMode } from "@/features/games/types";
import type { Gender } from "@/shared/types/gender";
import type { TournamentStatus } from "@/shared/types/tournament-status";

export type { Gender } from "@/shared/types/gender";

export type TeamStatus = "PENDING" | "APPROVED" | "REJECTED";
export type MemberRole =
  "CAPTAIN" | "PLAYER" | "SUBSTITUTE" | "COACH" | "MANAGER";

export interface TeamWithMembers {
  id: string;
  name: string;
  shortName: string | null;
  description: string | null;
  logoUrl: string | null;
  status: TeamStatus;
  seed: number | null;
  finalRank: number | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string | null;
  rejectReason: string | null;
  reviewedAt: string | null;
  captainId: string;
  tournamentId: string;
  captain: { id: string; displayName: string; avatarUrl: string | null };
  members?: TeamMember[];
  _count?: { members: number };
  registeredAt: string;
  updatedAt: string;
}

export interface TeamMember {
  id: string;
  realName: string;
  ign: string;
  inGameId?: string | null;
  birthDate?: string | null;
  gender?: Gender | null;
  email?: string | null;
  phoneNumber?: string | null;
  position: string | null;
  memberRole: MemberRole;
  avatarUrl: string | null;
  orderIndex: number;
}

export interface TeamDetail extends TeamWithMembers {
  members: TeamMember[];
  tournament: {
    id: string;
    slug: string;
    name: string;
    status: TournamentStatus;
    organizerId: string;
  };
  canViewSensitiveInfo: boolean;
  history: {
    completedMatches: number;
    wins: number;
    draws: number;
    losses: number;
    finalRank: number | null;
    recentMatches: Array<{
      id: string;
      scoreA: number;
      scoreB: number;
      winnerTeamId: string | null;
      outcome: "TEAM_A" | "TEAM_B" | "DRAW" | null;
      scheduledAt: string | null;
      playedAt: string | null;
      teamA: { id: string; name: string; shortName: string | null } | null;
      teamB: { id: string; name: string; shortName: string | null } | null;
      round: { id: string; name: string; format: string };
    }>;
  };
}

export type ApprovedTeam = Omit<TeamWithMembers, "members">;

export interface TeamMemberRegistration {
  realName: string;
  ign: string;
  inGameId?: string;
  birthDate?: string;
  gender?: Gender;
  email?: string;
  phoneNumber?: string;
  position?: string;
  memberRole?: MemberRole;
  avatarUrl?: string;
  orderIndex?: number;
}

export interface TeamRegistration {
  name: string;
  shortName?: string;
  logoUrl?: string;
  description?: string;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  members: TeamMemberRegistration[];
}

export interface TeamRegistrationForm {
  canRegister: boolean;
  reason: string | null;
  tournament: {
    id: string;
    slug: string;
    name: string;
    status: TournamentStatus;
    minTeamSize: number;
    maxTeamSize: number;
    maxSubstitutes: number;
    minAge: number | null;
    maxAge: number | null;
    allowedGenders: Gender[] | null;
    registrationStartDate: string | null;
    registrationDeadline: string | null;
    requireMemberFullInfo: boolean;
  };
  game: {
    id: string;
    name: string;
    genre: GameGenre;
    positions: string[];
    positionMode: GamePositionMode;
  };
  prefill: {
    contactName: string;
    contactEmail: string;
    contactPhone: string | null;
    captainMember: {
      realName: string;
      birthDate: string | null;
      gender: Gender | null;
      email: string;
      phoneNumber: string | null;
      memberRole: "CAPTAIN";
    };
  };
}

export interface MyTeam extends TeamWithMembers {
  tournament: {
    id: string;
    slug: string;
    name: string;
    status: TournamentStatus;
    bannerUrl: string | null;
    startDate: string | null;
    game: { id: string; name: string; iconUrl: string | null };
  };
}

export type UpdateTeamStatusRequest =
  { status: "APPROVED" } | { status: "REJECTED"; rejectReason: string };
