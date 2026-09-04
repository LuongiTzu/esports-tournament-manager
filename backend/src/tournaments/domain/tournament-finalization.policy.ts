import { RoundFormat } from '@prisma/client';

export type TournamentFinalizationMode =
  'MANUAL_STANDINGS' | 'AUTOMATIC_ELIMINATION' | 'UNSUPPORTED';

/** Describes which lifecycle owns completion for a terminal Round format. */
export function resolveTournamentFinalizationMode(
  format: RoundFormat,
): TournamentFinalizationMode {
  switch (format) {
    case RoundFormat.ROUND_ROBIN:
    case RoundFormat.SWISS:
      return 'MANUAL_STANDINGS';
    case RoundFormat.PLAYOFF:
    case RoundFormat.DOUBLE_ELIM:
      return 'AUTOMATIC_ELIMINATION';
    case RoundFormat.GROUP_STAGE:
      return 'UNSUPPORTED';
  }
}
