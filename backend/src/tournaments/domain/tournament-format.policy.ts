import { RoundFormat } from '@prisma/client';
import { ApplicationErrorCode } from '../../common/errors/application-error-code';

export const ELIMINATION_MUST_BE_TERMINAL =
  ApplicationErrorCode.ELIMINATION_MUST_BE_TERMINAL;

export interface TournamentFormatViolation {
  code: typeof ELIMINATION_MUST_BE_TERMINAL;
  message: string;
  terminalFormat: RoundFormat;
  terminalOrderIndex: number;
  attemptedFormat: RoundFormat;
  attemptedOrderIndex: number;
}

/** Pure policy for validating the ordered format chain of Tournament Rounds. */
export class TournamentFormatPolicy {
  validateAppend(
    previousFormat: RoundFormat | null,
    attemptedFormat: RoundFormat,
    attemptedOrderIndex: number,
  ): TournamentFormatViolation | null {
    if (!previousFormat || !isElimination(previousFormat)) return null;
    return {
      code: ELIMINATION_MUST_BE_TERMINAL,
      message: 'An elimination Round must be the final Round of a tournament',
      terminalFormat: previousFormat,
      terminalOrderIndex: attemptedOrderIndex - 1,
      attemptedFormat,
      attemptedOrderIndex,
    };
  }

  validateSequence(
    formats: readonly RoundFormat[],
  ): TournamentFormatViolation | null {
    for (let index = 1; index < formats.length; index += 1) {
      const violation = this.validateAppend(
        formats[index - 1],
        formats[index],
        index + 1,
      );
      if (violation) return violation;
    }
    return null;
  }
}

function isElimination(format: RoundFormat): boolean {
  return format === RoundFormat.PLAYOFF || format === RoundFormat.DOUBLE_ELIM;
}
