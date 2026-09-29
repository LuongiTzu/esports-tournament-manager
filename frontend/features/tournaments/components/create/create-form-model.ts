import type { GameStructureValue } from "@/features/games/components/GameStructureFields";
import type { RoundFormatValue } from "@/features/tournaments/round-formats";
import type { MatchScoringMode } from "@/features/tournaments/types";

export interface RoundForm {
  name: string;
  format: RoundFormatValue;
  bestOf: string;
  scoringMode: MatchScoringMode;
  roundRobin: {
    advancingTeamCount: string;
    winPoints: string;
    drawPoints: string;
    lossPoints: string;
    allowDraws: boolean;
    meetingsPerPair: string;
  };
  groupStage: {
    numberOfGroups: string;
    advancingTeamsPerGroup: string;
    winPoints: string;
    drawPoints: string;
    lossPoints: string;
    allowDraws: boolean;
    meetingsPerPair: string;
  };
  swiss: {
    mode: string;
    winsToAdvance: string;
    lossesToEliminate: string;
    numberOfRounds: string;
    advancingTeamCount: string;
  };
  playoff: { thirdPlaceMatch: boolean };
  doubleElim: { grandFinalReset: boolean };
}

const DEFAULT_ROUND_ROBIN_SETTINGS: RoundForm["roundRobin"] = {
  advancingTeamCount: "2",
  winPoints: "3",
  drawPoints: "1",
  lossPoints: "0",
  allowDraws: false,
  meetingsPerPair: "1",
};

const DEFAULT_GROUP_STAGE_SETTINGS: RoundForm["groupStage"] = {
  numberOfGroups: "2",
  advancingTeamsPerGroup: "2",
  winPoints: "3",
  drawPoints: "1",
  lossPoints: "0",
  allowDraws: false,
  meetingsPerPair: "1",
};

const DEFAULT_SWISS_SETTINGS: RoundForm["swiss"] = {
  mode: "FIXED_ROUNDS",
  winsToAdvance: "3",
  lossesToEliminate: "3",
  numberOfRounds: "",
  advancingTeamCount: "8",
};

export function createRoundForm(
  name: string,
  format: RoundFormatValue,
): RoundForm {
  return {
    name,
    format,
    bestOf: "1",
    scoringMode: "SERIES_SCORE",
    roundRobin: { ...DEFAULT_ROUND_ROBIN_SETTINGS },
    groupStage: { ...DEFAULT_GROUP_STAGE_SETTINGS },
    swiss: { ...DEFAULT_SWISS_SETTINGS },
    playoff: { thirdPlaceMatch: true },
    doubleElim: { grandFinalReset: true },
  };
}

export interface TournamentFormState extends GameStructureValue {
  isOfficial: boolean;
  name: string;
  gameId: string;
  customGameName: string;
  description: string;
  rules: string;
  visibility: "PUBLIC" | "PRIVATE";
  status: "DRAFT" | "REGISTRATION";
  mode: "ONLINE" | "OFFLINE" | "HYBRID";
  location: string;
  registrationOpen: boolean;
  maxTeams: string;
  minAge: string;
  maxAge: string;
  allowedGenders: Array<"MALE" | "FEMALE" | "OTHER">;
  registrationStartDate: string;
  registrationDeadline: string;
  startDate: string;
  endDate: string;
  autoApproveTeams: boolean;
  requireMemberFullInfo: boolean;
  prizePool: string;
  contactEmail: string;
  contactPhone: string;
  contactLink: string;
}

export const INITIAL_FORM: TournamentFormState = {
  isOfficial: false,
  name: "",
  gameId: "",
  teamSize: "",
  customGameName: "",
  description: "",
  rules: "",
  visibility: "PUBLIC",
  status: "REGISTRATION",
  mode: "ONLINE",
  location: "",
  registrationOpen: true,
  maxTeams: "",
  maxTeamSize: "",
  minAge: "",
  maxAge: "",
  allowedGenders: [],
  registrationStartDate: "",
  registrationDeadline: "",
  startDate: "",
  endDate: "",
  autoApproveTeams: false,
  requireMemberFullInfo: true,
  prizePool: "",
  contactEmail: "",
  contactPhone: "",
  contactLink: "",
};

export function optionalNumber(value: string) {
  return value === "" ? undefined : Number(value);
}

export function optionalIsoDate(value: string) {
  return value ? new Date(value).toISOString() : undefined;
}
