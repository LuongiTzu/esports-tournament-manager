import { TournamentStatus } from '@prisma/client';
import {
  InvalidTournamentStatusTransitionError,
  TournamentLifecyclePolicy,
} from './tournament-lifecycle.policy';

describe('TournamentLifecyclePolicy', () => {
  const policy = new TournamentLifecyclePolicy();

  it.each([
    [TournamentStatus.DRAFT, TournamentStatus.REGISTRATION],
    [TournamentStatus.DRAFT, TournamentStatus.CANCELLED],
    [TournamentStatus.REGISTRATION, TournamentStatus.ONGOING],
    [TournamentStatus.REGISTRATION, TournamentStatus.CANCELLED],
    [TournamentStatus.ONGOING, TournamentStatus.CANCELLED],
  ])('allows %s -> %s', (currentStatus, targetStatus) => {
    expect(() =>
      policy.assertCanTransition(currentStatus, targetStatus),
    ).not.toThrow();
  });

  it.each(Object.values(TournamentStatus))(
    'accepts same-status updates for %s',
    (status) => {
      expect(() => policy.assertCanTransition(status, status)).not.toThrow();
    },
  );

  it.each([
    [TournamentStatus.DRAFT, TournamentStatus.ONGOING],
    [TournamentStatus.REGISTRATION, TournamentStatus.DRAFT],
    [TournamentStatus.ONGOING, TournamentStatus.REGISTRATION],
    [TournamentStatus.ONGOING, TournamentStatus.COMPLETED],
    [TournamentStatus.COMPLETED, TournamentStatus.ONGOING],
    [TournamentStatus.CANCELLED, TournamentStatus.DRAFT],
  ])('rejects %s -> %s', (currentStatus, targetStatus) => {
    expect(() =>
      policy.assertCanTransition(currentStatus, targetStatus),
    ).toThrow(
      expect.objectContaining({
        code: 'INVALID_TOURNAMENT_STATUS_TRANSITION',
        currentStatus,
        targetStatus,
      }) as InvalidTournamentStatusTransitionError,
    );
  });
});
