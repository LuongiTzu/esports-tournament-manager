import { TournamentStatus } from '@prisma/client';
import {
  gameConfigurationLockReason,
  participantLockReason,
  registrationWindowReason,
  tournamentStartReasons,
} from './tournament-management.policy';

describe('Tournament management eligibility', () => {
  const now = new Date('2026-09-11T12:00:00Z');
  const registration = {
    status: TournamentStatus.REGISTRATION,
    registrationOpen: true,
    registrationStartDate: new Date('2026-09-01T00:00:00Z'),
    registrationDeadline: new Date('2026-09-12T00:00:00Z'),
    startDate: new Date('2026-09-13T00:00:00Z'),
  };

  it.each([
    [TournamentStatus.DRAFT, null],
    [TournamentStatus.REGISTRATION, null],
    [TournamentStatus.ONGOING, 'SETUP_CLOSED'],
    [TournamentStatus.COMPLETED, 'SETUP_CLOSED'],
    [TournamentStatus.CANCELLED, 'SETUP_CLOSED'],
  ] as const)(
    'uses lifecycle state even with no persisted structure: %s',
    (status, reason) => {
      expect(participantLockReason(status, false)).toBe(reason);
      expect(gameConfigurationLockReason(status, 0, false)).toBe(reason);
    },
  );

  it('locks game configuration for pending registrations too', () => {
    expect(
      gameConfigurationLockReason(TournamentStatus.REGISTRATION, 1, false),
    ).toBe('TEAMS_EXIST');
  });

  it('closes participant changes before starting if structure exists', () => {
    expect(participantLockReason(TournamentStatus.REGISTRATION, true)).toBe(
      'STRUCTURE_EXISTS',
    );
  });

  it.each([
    [{}, null],
    [{ registrationOpen: false }, 'REGISTRATION_CLOSED'],
    [
      { registrationStartDate: new Date(now.getTime() + 1) },
      'REGISTRATION_NOT_STARTED',
    ],
    [{ registrationStartDate: now }, null],
    [{ registrationDeadline: now }, null],
    [
      { registrationDeadline: new Date(now.getTime() - 1) },
      'REGISTRATION_EXPIRED',
    ],
    [{ startDate: now }, 'TOURNAMENT_STARTED'],
    [{ status: TournamentStatus.ONGOING }, 'STATUS_NOT_REGISTRATION'],
  ] as const)(
    'reports the effective registration window: %s',
    (changes, reason) => {
      expect(
        registrationWindowReason({ ...registration, ...changes }, now),
      ).toBe(reason);
    },
  );

  it('reports all missing start prerequisites together', () => {
    expect(
      tournamentStartReasons(TournamentStatus.REGISTRATION, true, 1, 0),
    ).toEqual([
      'REGISTRATION_MUST_BE_CLOSED',
      'NOT_ENOUGH_TEAMS',
      'FIRST_ROUND_NOT_GENERATED',
    ]);
    expect(
      tournamentStartReasons(TournamentStatus.REGISTRATION, false, 2, 1),
    ).toEqual([]);
  });
});
