import { TournamentStatus } from '@prisma/client';

export type DownstreamResetBlockedReason =
  'TOURNAMENT_LOCKED' | 'NO_DOWNSTREAM_ROUNDS' | 'NO_DOWNSTREAM_DATA';

export function downstreamResetBlockedReason(input: {
  tournamentStatus: TournamentStatus;
  downstreamRoundCount: number;
  resettableItemCount: number;
}): DownstreamResetBlockedReason | null {
  if (
    input.tournamentStatus === TournamentStatus.DRAFT ||
    input.tournamentStatus === TournamentStatus.CANCELLED
  ) {
    return 'TOURNAMENT_LOCKED';
  }
  if (input.downstreamRoundCount === 0) return 'NO_DOWNSTREAM_ROUNDS';
  if (input.resettableItemCount === 0) return 'NO_DOWNSTREAM_DATA';
  return null;
}

export function tournamentStatusAfterDownstreamReset(
  status: TournamentStatus,
): TournamentStatus {
  return status === TournamentStatus.COMPLETED
    ? TournamentStatus.ONGOING
    : status;
}
