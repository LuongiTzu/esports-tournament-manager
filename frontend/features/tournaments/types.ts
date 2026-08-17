import type { Game, GameRef } from "@/features/games/types";
import type { ApprovedTeam } from "@/features/teams/types";
import type { TournamentStatus } from "@/shared/types/tournament-status";

export interface Tournament {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  rules?: string | null;
  bannerUrl?: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  status: TournamentStatus;
  moderationStatus?: "ACTIVE" | "HIDDEN_BY_ADMIN";
  isVerified?: boolean;
  registrationOpen: boolean;
  maxTeams?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  game?: GameRef;
  organizer?: { id: string; displayName: string; avatarUrl?: string | null };
  rounds?: Array<{ id: string; name: string; format: string }>;
  _count?: { teams: number; comments?: number };
  createdAt: string;
}

export interface FindAllTournamentsParams {
  search?: string;
  gameId?: string;
  status?: Tournament["status"];
  page?: number;
  limit?: number;
}

export interface Paginated<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TournamentDetail extends Omit<Tournament, "game"> {
  game: Game;
  teams: ApprovedTeam[];
}
