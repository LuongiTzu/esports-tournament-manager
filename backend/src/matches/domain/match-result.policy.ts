import { MatchOutcome, MatchStatus, RoundFormat } from '@prisma/client';
import { resolveMatchScoringMode } from '../../common/domain/match-scoring';

export interface MatchResultContext {
  bestOf: number;
  teamAId: string | null;
  teamBId: string | null;
  roundFormat: RoundFormat;
  roundSettings: unknown;
}

export interface MatchGameScore {
  setNumber: number;
  teamAScore: number;
  teamBScore: number;
}

export class MatchResultRuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MatchResultRuleError';
  }
}

export class MatchResultPolicy {
  evaluateAggregate(
    context: MatchResultContext,
    scoreA: number,
    scoreB: number,
    status: MatchStatus,
  ): { winnerTeamId: string | null; outcome: MatchOutcome | null } {
    this.assertScoringCompatibility(context.bestOf, context.roundSettings);
    if (resolveMatchScoringMode(context.roundSettings) === 'POINT_SCORE') {
      return this.evaluatePointAggregate(context, scoreA, scoreB, status);
    }
    const winsRequired = Math.floor(context.bestOf / 2) + 1;
    if (scoreA > winsRequired || scoreB > winsRequired) {
      throw new MatchResultRuleError(
        'Score exceeds the wins required by bestOf',
      );
    }
    if (scoreA + scoreB > context.bestOf) {
      throw new MatchResultRuleError('Score exceeds the maximum game count');
    }
    if (status !== MatchStatus.COMPLETED) {
      if (scoreA === winsRequired || scoreB === winsRequired) {
        throw new MatchResultRuleError('A clinched series must be COMPLETED');
      }
      return { winnerTeamId: null, outcome: null };
    }
    if (!context.teamAId || !context.teamBId) {
      throw new MatchResultRuleError('Both match slots must be populated');
    }
    if (scoreA === scoreB) {
      if (!this.allowsDraw(context)) {
        throw new MatchResultRuleError(
          'Completed match must have one valid winner',
        );
      }
      return { winnerTeamId: null, outcome: MatchOutcome.DRAW };
    }
    if ((scoreA === winsRequired) === (scoreB === winsRequired)) {
      throw new MatchResultRuleError(
        'Completed match must have one valid winner',
      );
    }
    return scoreA === winsRequired
      ? { winnerTeamId: context.teamAId, outcome: MatchOutcome.TEAM_A }
      : { winnerTeamId: context.teamBId, outcome: MatchOutcome.TEAM_B };
  }

  evaluateDetailedScores(
    scores: MatchGameScore[],
    context: MatchResultContext,
  ) {
    if (resolveMatchScoringMode(context.roundSettings) === 'SERIES_SCORE') {
      return this.evaluateSeries(scores, context.bestOf);
    }
    this.assertScoringCompatibility(context.bestOf, context.roundSettings);
    this.assertScoreSequence(scores, context.bestOf);
    if (scores.length !== 1) {
      throw new MatchResultRuleError(
        'POINT_SCORE requires exactly one score record',
      );
    }
    return {
      scoreA: scores[0].teamAScore,
      scoreB: scores[0].teamBScore,
      completed: true,
    };
  }

  evaluateSeries(scores: MatchGameScore[], bestOf: number) {
    this.assertBestOf(bestOf);
    const sorted = this.assertScoreSequence(scores, bestOf);
    const winsRequired = Math.floor(bestOf / 2) + 1;
    let scoreA = 0;
    let scoreB = 0;
    sorted.forEach((game, index) => {
      if (game.teamAScore === game.teamBScore) {
        throw new MatchResultRuleError('Individual games cannot end in a draw');
      }
      if (scoreA === winsRequired || scoreB === winsRequired) {
        throw new MatchResultRuleError(
          `Game ${index + 1} occurs after the series was already won`,
        );
      }
      if (game.teamAScore > game.teamBScore) scoreA++;
      else scoreB++;
    });
    return {
      scoreA,
      scoreB,
      completed: scoreA === winsRequired || scoreB === winsRequired,
    };
  }

  assertBestOf(bestOf: number): void {
    if (!Number.isInteger(bestOf) || bestOf < 1 || bestOf % 2 === 0) {
      throw new MatchResultRuleError('bestOf must be a positive odd number');
    }
  }

  assertScoringCompatibility(bestOf: number, settings: unknown): void {
    this.assertBestOf(bestOf);
    if (resolveMatchScoringMode(settings) === 'POINT_SCORE' && bestOf !== 1) {
      throw new MatchResultRuleError('POINT_SCORE requires bestOf = 1');
    }
  }

  private evaluatePointAggregate(
    context: MatchResultContext,
    scoreA: number,
    scoreB: number,
    status: MatchStatus,
  ): { winnerTeamId: string | null; outcome: MatchOutcome | null } {
    if (status !== MatchStatus.COMPLETED) {
      return { winnerTeamId: null, outcome: null };
    }
    if (!context.teamAId || !context.teamBId) {
      throw new MatchResultRuleError('Both match slots must be populated');
    }
    if (scoreA === scoreB) {
      if (!this.allowsDraw(context)) {
        throw new MatchResultRuleError(
          'Completed match must have one valid winner',
        );
      }
      return { winnerTeamId: null, outcome: MatchOutcome.DRAW };
    }
    return scoreA > scoreB
      ? { winnerTeamId: context.teamAId, outcome: MatchOutcome.TEAM_A }
      : { winnerTeamId: context.teamBId, outcome: MatchOutcome.TEAM_B };
  }

  private assertScoreSequence(
    scores: MatchGameScore[],
    bestOf: number,
  ): MatchGameScore[] {
    if (scores.length > bestOf) {
      throw new MatchResultRuleError('Too many games for match bestOf');
    }
    const sorted = [...scores].sort(
      (left, right) => left.setNumber - right.setNumber,
    );
    if (
      new Set(sorted.map((score) => score.setNumber)).size !== sorted.length
    ) {
      throw new MatchResultRuleError('setNumber must be unique');
    }
    if (sorted.some((score, index) => score.setNumber !== index + 1)) {
      throw new MatchResultRuleError('setNumber must be consecutive from 1');
    }
    return sorted;
  }

  private allowsDraw(context: MatchResultContext): boolean {
    if (
      context.roundFormat !== RoundFormat.ROUND_ROBIN &&
      context.roundFormat !== RoundFormat.GROUP_STAGE
    ) {
      return false;
    }
    const settings = context.roundSettings;
    return (
      typeof settings === 'object' &&
      settings !== null &&
      !Array.isArray(settings) &&
      (settings as Record<string, unknown>).allowDraws === true
    );
  }
}
