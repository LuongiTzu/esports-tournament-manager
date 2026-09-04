import { TournamentStatus } from '@prisma/client';
import { ApplicationErrorCode } from '../../common/errors/application-error-code';

const ALLOWED_TRANSITIONS: Readonly<
  Record<TournamentStatus, readonly TournamentStatus[]>
> = {
  [TournamentStatus.DRAFT]: [
    TournamentStatus.REGISTRATION,
    TournamentStatus.CANCELLED,
  ],
  [TournamentStatus.REGISTRATION]: [
    TournamentStatus.ONGOING,
    TournamentStatus.CANCELLED,
  ],
  [TournamentStatus.ONGOING]: [TournamentStatus.CANCELLED],
  [TournamentStatus.COMPLETED]: [],
  [TournamentStatus.CANCELLED]: [],
};

export class InvalidTournamentStatusTransitionError extends Error {
  readonly code = ApplicationErrorCode.INVALID_TOURNAMENT_STATUS_TRANSITION;

  constructor(
    readonly currentStatus: TournamentStatus,
    readonly targetStatus: TournamentStatus,
  ) {
    super(
      `Không thể chuyển trạng thái giải đấu từ ${currentStatus} sang ${targetStatus}`,
    );
    this.name = 'InvalidTournamentStatusTransitionError';
  }
}

export class TournamentLifecyclePolicy {
  assertCanTransition(
    currentStatus: TournamentStatus,
    targetStatus: TournamentStatus,
  ): void {
    if (currentStatus === targetStatus) return;

    if (!ALLOWED_TRANSITIONS[currentStatus].includes(targetStatus)) {
      throw new InvalidTournamentStatusTransitionError(
        currentStatus,
        targetStatus,
      );
    }
  }
}
