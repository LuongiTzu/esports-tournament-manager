import type { Game, GameRef } from "@/features/games/types";
import type { ApprovedTeam } from "@/features/teams/types";
import type { Gender } from "@/shared/types/gender";
import type { TournamentStatus } from "@/shared/types/tournament-status";

export type { Paginated } from "@/shared/types/pagination";

export type TournamentVisibility = "PUBLIC" | "PRIVATE";
export type TournamentMode = "ONLINE" | "OFFLINE" | "HYBRID";

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

export type RoundStatus = "UPCOMING" | "ONGOING" | "COMPLETED";
export type MatchStatus = "PENDING" | "ONGOING" | "COMPLETED";
export type MatchOutcome = "TEAM_A" | "TEAM_B" | "DRAW";
export type BracketType = "WINNER" | "LOSER";

type TournamentRoundBase = {
  id: string;
  name: string;
  orderIndex: number;
  bestOf: number;
  status: RoundStatus;
  _count?: { matches: number };
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
  visibility: TournamentVisibility;
  mode: TournamentMode;
  status: TournamentStatus;
  moderationStatus?: "ACTIVE" | "HIDDEN_BY_ADMIN";
  isVerified?: boolean;
  registrationOpen: boolean;
  minTeamSize: number;
  maxTeamSize: number;
  location?: string | null;
  minAge?: number | null;
  maxAge?: number | null;
  allowedGenders?: Gender[] | null;
  autoApproveTeams?: boolean;
  requireMemberFullInfo?: boolean;
  customGameName?: string | null;
  displayGameName?: string;
  registrationStartDate?: string | null;
  registrationDeadline?: string | null;
  maxTeams?: number | null;
  startDate?: string | null;
  endDate?: string | null;
  prizePool?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  contactLink?: string | null;
  game?: GameRef;
  organizer?: { id: string; displayName: string; avatarUrl?: string | null };
  rounds?: TournamentRound[];
  _count?: { teams: number; comments?: number };
  favoriteCount: number;
  isFavorited: boolean;
  createdAt: string;
}

export interface TournamentFavoriteMutationResult {
  isFavorited: boolean;
  favoriteCount: number;
}

export interface FindAllTournamentsParams {
  search?: string;
  gameId?: string;
  status?: Tournament["status"];
  page?: number;
  limit?: number;
}

export interface TournamentDetail extends Omit<Tournament, "game"> {
  game: Game;
  teams: ApprovedTeam[];
}

export interface TournamentMutationResult extends Omit<Tournament, "game"> {
  game: Game;
}

export interface BracketTeam {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  seed: number | null;
}

export interface BracketGroup {
  id: string;
  name: string;
  orderIndex: number;
  teams: BracketTeam[];
}

export interface BracketMatch {
  id: string;
  groupId: string | null;
  bracketRound: number | null;
  bracketType: BracketType | null;
  matchNumber: number | null;
  status: MatchStatus;
  outcome: MatchOutcome | null;
  isActive: boolean;
  activationCondition: "LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL" | null;
  isBye: boolean;
  bestOf: number;
  scheduledAt: string | null;
  slots: { A: BracketTeam | null; B: BracketTeam | null };
  score: { A: number; B: number };
  winner: BracketTeam | null;
  nextMatch: { id: string | null; slot: "A" | "B" | null };
  loserNextMatch: { id: string | null; slot: "A" | "B" | null };
}

export interface RoundBracket {
  round: TournamentRound;
  groups: BracketGroup[];
  matches: BracketMatch[];
}

export interface TournamentBracket {
  tournament: { id: string; name: string; slug: string };
  rounds: RoundBracket[];
}

export interface BasicStanding {
  id: string;
  name: string;
  seed: number | null;
  rank: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  points: number;
  scoreDifference: number;
}

export interface GroupStanding {
  groupId: string;
  name: string;
  orderIndex: number;
  standings: BasicStanding[];
}

export interface SwissStanding {
  rank: number;
  teamId: string;
  team: BracketTeam | null;
  played: number;
  wins: number;
  losses: number;
  points: number;
  byes: number;
  buchholz: number;
  buchholzCut1: number;
  scoreDifference: number;
  opponents: string[];
}

export type RoundProgressionState =
  | "NOT_GENERATED"
  | "IN_PROGRESS"
  | "TERMINAL_COMPLETE"
  | "ADVANCEMENT_UNSUPPORTED"
  | "AWAITING_ADVANCEMENT"
  | "READY_FOR_GENERATION"
  | "NEXT_STAGE_GENERATED"
  | "NEXT_STAGE_COMPLETED";

export interface RoundParticipantAssignment {
  createdAt: string;
  team: BracketTeam;
  advancedFromRound: Pick<
    TournamentRound,
    "id" | "name" | "orderIndex" | "format"
  > | null;
}

export interface QualifiedTeamAssignment {
  advancedAt: string;
  team: BracketTeam;
  targetRound: Pick<
    TournamentRound,
    "id" | "name" | "orderIndex" | "format" | "status"
  >;
}

interface RoundStandingsBase {
  roundId: string;
  round: Pick<
    TournamentRound,
    "id" | "name" | "orderIndex" | "format" | "status"
  >;
  progress: {
    totalMatches: number;
    completedMatches: number;
    requiredMatches: number;
    completedRequiredMatches: number;
    allRequiredMatchesCompleted: boolean;
  };
  participants: RoundParticipantAssignment[];
  advancement: {
    supported: boolean;
    state: RoundProgressionState;
    readinessReason: string | null;
    nextRound:
      | (Pick<
          TournamentRound,
          "id" | "name" | "orderIndex" | "format" | "status"
        > & {
          participantCount: number;
          matchCount: number;
        })
      | null;
    qualifiedTeams: QualifiedTeamAssignment[];
  };
}

export type RoundStandings =
  | (RoundStandingsBase & {
      format: "ROUND_ROBIN";
      standings: BasicStanding[];
    })
  | (RoundStandingsBase & {
      format: "GROUP_STAGE";
      standings: GroupStanding[];
    })
  | (RoundStandingsBase & {
      format: "SWISS";
      standings: SwissStanding[];
    })
  | (RoundStandingsBase & {
      format: "PLAYOFF" | "DOUBLE_ELIM";
      standings: [];
    });

export interface TournamentStandingsResponse {
  tournamentId: string;
  tournament: {
    id: string;
    name: string;
    status: TournamentStatus;
    champion: BracketTeam | null;
  };
  rounds: RoundStandings[];
}

export interface GenerateRoundResult {
  roundId: string;
  format: TournamentRound["format"];
  approvedTeamCount: number;
  matchCount: number;
  force: boolean;
}

export interface GenerateSwissIterationResult {
  roundId: string;
  bracketRound: number;
  numberOfRounds: number;
  matchCount: number;
  matchIds: string[];
  bye: { matchId: string; teamId: string } | null;
  warnings: string[];
}

export interface AdvanceRoundResult {
  roundId: string;
  currentRound: {
    id: string;
    format: TournamentRound["format"];
    orderIndex: number;
  };
  nextRound: {
    id: string;
    name: string;
    format: TournamentRound["format"];
  } | null;
  advanceCount: number;
  advanceCountPerGroup?: number;
  qualifiedTeams: Array<
    Pick<BracketTeam, "id" | "name" | "seed"> &
      Partial<Pick<BracketTeam, "shortName" | "logoUrl">>
  >;
  teamIds: string[];
  progressionMode: "ROUND_PARTICIPANTS" | "MATCH_LINKAGE";
  prepared: boolean;
  persisted: boolean;
}

export interface UpdateTournamentLifecycleRequest {
  status?: Tournament["status"];
  registrationOpen?: boolean;
}

export interface CreateTournamentRequest {
  name: string;
  gameId: string;
  teamSize?: number;
  customGameName?: string;
  description?: string;
  rules?: string;
  bannerUrl?: string;
  visibility: TournamentVisibility;
  status: "DRAFT" | "REGISTRATION";
  mode: TournamentMode;
  location?: string;
  registrationOpen: boolean;
  maxTeams?: number;
  maxTeamSize: number;
  minAge?: number;
  maxAge?: number;
  allowedGenders?: Gender[];
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

export type UpdateTournamentRequest = Partial<
  Omit<CreateTournamentRequest, "rounds">
>;
