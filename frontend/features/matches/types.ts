import type {
  BracketTeam,
  BracketType,
  MatchOutcome,
  MatchStatus,
  TournamentRound,
} from "@/features/tournaments/types";

export interface MatchGameScore {
  setNumber: number;
  teamAScore: number;
  teamBScore: number;
}

export interface MatchDetail {
  id: string;
  scoreA: number;
  scoreB: number;
  status: MatchStatus;
  outcome: MatchOutcome | null;
  isActive: boolean;
  activationCondition: "LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL" | null;
  bracketType: BracketType | null;
  bracketRound: number | null;
  matchNumber: number | null;
  isBye: boolean;
  bestOf: number;
  scheduledAt: string | null;
  playedAt: string | null;
  discordLink: string | null;
  teamA: BracketTeam | null;
  teamB: BracketTeam | null;
  winner: BracketTeam | null;
  scores: MatchGameScore[];
  round: {
    id: string;
    name: string;
    format: TournamentRound["format"];
    tournament: { id: string; name: string; slug: string };
  };
}

export interface UpdateMatchRequest {
  scoreA?: number;
  scoreB?: number;
  scheduledAt?: string | null;
  discordLink?: string | null;
  status?: MatchStatus;
}

export interface PutMatchScoresRequest {
  scores: MatchGameScore[];
}

export interface MatchMutationResult {
  id: string;
  scoreA: number;
  scoreB: number;
  status: MatchStatus;
  outcome: MatchOutcome | null;
  winnerTeamId: string | null;
  scheduledAt: string | null;
  discordLink: string | null;
}
