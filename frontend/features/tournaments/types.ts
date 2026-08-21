import type { Game, GameRef } from "@/features/games/types";
import type { ApprovedTeam } from "@/features/teams/types";
import type { TournamentStatus } from "@/shared/types/tournament-status";

export interface RoundRobinSettings {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  allowDraws: boolean;
  meetingsPerPair: number;
}

export interface GroupStageSettings {
  numberOfGroups: number;
  advancingTeamsPerGroup: number;
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  allowDraws: boolean;
  meetingsPerPair: number;
}

export interface SwissSettings {
  numberOfRounds: number | null;
  advancingTeamCount: number;
}

export interface PlayoffSettings {
  thirdPlaceMatch: boolean;
}

export interface DoubleElimSettings {
  grandFinalReset: boolean;
}

export type CreateRoundRequest =
  | {
      name: string;
      format: "ROUND_ROBIN";
      bestOf: number;
      settings: RoundRobinSettings;
    }
  | {
      name: string;
      format: "GROUP_STAGE";
      bestOf: number;
      settings: GroupStageSettings;
    }
  | {
      name: string;
      format: "SWISS";
      bestOf: number;
      settings: SwissSettings;
    }
  | {
      name: string;
      format: "PLAYOFF";
      bestOf: number;
      settings: PlayoffSettings;
    }
  | {
      name: string;
      format: "DOUBLE_ELIM";
      bestOf: number;
      settings: DoubleElimSettings;
    };

type TournamentRoundBase = {
  id: string;
  name: string;
  bestOf: number;
};

export type TournamentRound =
  | (TournamentRoundBase & {
      format: "ROUND_ROBIN";
      settings: RoundRobinSettings;
    })
  | (TournamentRoundBase & {
      format: "GROUP_STAGE";
      settings: GroupStageSettings;
    })
  | (TournamentRoundBase & {
      format: "SWISS";
      settings: SwissSettings;
    })
  | (TournamentRoundBase & {
      format: "PLAYOFF";
      settings: PlayoffSettings;
    })
  | (TournamentRoundBase & {
      format: "DOUBLE_ELIM";
      settings: DoubleElimSettings;
    });

export interface Tournament {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  rules?: string | null;
  bannerUrl?: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  mode: "ONLINE" | "OFFLINE" | "HYBRID";
  status: TournamentStatus;
  moderationStatus?: "ACTIVE" | "HIDDEN_BY_ADMIN";
  isVerified?: boolean;
  registrationOpen: boolean;
  maxTeams?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  game?: GameRef;
  organizer?: { id: string; displayName: string; avatarUrl?: string | null };
  rounds?: TournamentRound[];
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

export interface CreateTournamentRequest {
  name: string;
  gameId: string;
  description?: string;
  rules?: string;
  bannerUrl?: string;
  visibility: "PUBLIC" | "PRIVATE";
  status: "DRAFT" | "REGISTRATION";
  mode: "ONLINE" | "OFFLINE" | "HYBRID";
  location?: string;
  registrationOpen: boolean;
  maxTeams?: number;
  maxTeamSize: number;
  minAge?: number;
  maxAge?: number;
  allowedGenders?: Array<"MALE" | "FEMALE" | "OTHER">;
  registrationStartDate?: string;
  registrationDeadline?: string;
  startDate?: string;
  endDate?: string;
  autoApproveTeams: boolean;
  requireMemberFullInfo: boolean;
  prizePool?: string;
  contactEmail?: string;
  contactPhone?: string;
  contactLink?: string;
  rounds: CreateRoundRequest[];
}
