import { BracketType, RoundFormat } from '@prisma/client';
import { RoundSettingsFor } from './round-settings';

/** Minimal, stable team data required by pure bracket algorithms. */
export interface BracketTeam {
  id: string;
  name: string;
  seed: number | null;
  registeredAt: Date;
}

/** A participant can be known now or supplied by an earlier draft match. */
export interface MatchParticipantDraft {
  teamId: string | null;
  sourceMatchKey?: string;
  sourceResult?: 'WINNER' | 'LOSER';
}

export type MatchSlot = 'A' | 'B';

/** Temporary group identity used until Group records are persisted. */
export interface MatchDraftGroup {
  key: string;
  name: string;
  orderIndex: number;
}

/**
 * Persistence-neutral match representation produced by every strategy.
 * Link fields use deterministic draft keys because database IDs do not exist yet.
 */
export interface MatchDraft {
  key: string;
  /** Display label for the bracket round; not currently persisted by Match. */
  roundName?: string;
  /** Distinguishes the optional bronze match from the elimination tree. */
  matchKind?: 'STANDARD' | 'THIRD_PLACE' | 'GRAND_FINAL' | 'GRAND_FINAL_RESET';
  /** Pure-generation condition; the current Match schema has no reset metadata. */
  activationCondition?: 'LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL';
  teamA: MatchParticipantDraft;
  teamB: MatchParticipantDraft;
  bracketRound: number;
  bracketType: BracketType | null;
  matchNumber: number;
  isBye: boolean;
  bestOf: number;
  nextMatchKey: string | null;
  nextMatchSlot: MatchSlot | null;
  loserNextMatchKey: string | null;
  loserNextMatchSlot: MatchSlot | null;
  group?: MatchDraftGroup;
}

export interface BracketGeneratorInput<F extends RoundFormat = RoundFormat> {
  format: F;
  teams: readonly BracketTeam[];
  settings: RoundSettingsFor<F>;
  bestOf: number;
}

export interface IBracketGenerator<F extends RoundFormat = RoundFormat> {
  readonly format: F;
  generate(input: BracketGeneratorInput<F>): MatchDraft[];
}
