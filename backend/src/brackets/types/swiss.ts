import { BracketTeam, MatchDraft } from './bracket-generator';
import { SwissSettings } from './round-settings';

export interface SwissMatchSnapshot {
  teamAId: string;
  teamBId: string | null;
  scoreA: number;
  scoreB: number;
  bracketRound: number;
  isBye: boolean;
  completed: boolean;
}

export interface SwissStanding {
  rank: number;
  teamId: string;
  points: number;
  played: number;
  wins: number;
  losses: number;
  byes: number;
  buchholz: number;
  buchholzCut1: number;
  scoreDifference: number;
  opponents: string[];
}

export interface SwissPairingInput {
  teams: readonly BracketTeam[];
  matches: readonly SwissMatchSnapshot[];
  settings: SwissSettings;
  bestOf: number;
  bracketRound: number;
}

export interface SwissPairingResult {
  matches: MatchDraft[];
  warnings: string[];
}
