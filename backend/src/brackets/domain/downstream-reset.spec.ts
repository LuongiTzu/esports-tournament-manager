import { TournamentStatus } from '@prisma/client';
import {
  downstreamResetBlockedReason,
  tournamentStatusAfterDownstreamReset,
} from './downstream-reset';

describe('downstream reset policy', () => {
  it('allows a reset when downstream competition data exists', () => {
    expect(
      downstreamResetBlockedReason({
        tournamentStatus: TournamentStatus.ONGOING,
        downstreamRoundCount: 2,
        resettableItemCount: 5,
      }),
    ).toBeNull();
  });

  it('blocks drafts, cancelled tournaments and empty downstream state', () => {
    expect(
      downstreamResetBlockedReason({
        tournamentStatus: TournamentStatus.CANCELLED,
        downstreamRoundCount: 1,
        resettableItemCount: 1,
      }),
    ).toBe('TOURNAMENT_LOCKED');
    expect(
      downstreamResetBlockedReason({
        tournamentStatus: TournamentStatus.ONGOING,
        downstreamRoundCount: 0,
        resettableItemCount: 1,
      }),
    ).toBe('NO_DOWNSTREAM_ROUNDS');
    expect(
      downstreamResetBlockedReason({
        tournamentStatus: TournamentStatus.ONGOING,
        downstreamRoundCount: 1,
        resettableItemCount: 0,
      }),
    ).toBe('NO_DOWNSTREAM_DATA');
  });

  it('reopens only a completed tournament', () => {
    expect(
      tournamentStatusAfterDownstreamReset(TournamentStatus.COMPLETED),
    ).toBe(TournamentStatus.ONGOING);
    expect(
      tournamentStatusAfterDownstreamReset(TournamentStatus.REGISTRATION),
    ).toBe(TournamentStatus.REGISTRATION);
  });
});
