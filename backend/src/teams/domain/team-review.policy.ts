import { RegistrationStatus } from '@prisma/client';
import { ApplicationErrorCode } from '../../common/errors/application-error-code';

export class InvalidRegistrationStatusTransitionError extends Error {
  readonly code = ApplicationErrorCode.INVALID_REGISTRATION_STATUS_TRANSITION;

  constructor(
    readonly currentStatus: RegistrationStatus,
    readonly targetStatus: RegistrationStatus,
  ) {
    super(
      `Không thể chuyển trạng thái đăng ký từ ${currentStatus} sang ${targetStatus}`,
    );
    this.name = 'InvalidRegistrationStatusTransitionError';
  }
}

export class TeamReviewPolicy {
  assertCanReview(
    currentStatus: RegistrationStatus,
    targetStatus: RegistrationStatus,
  ): void {
    const validTarget =
      targetStatus === RegistrationStatus.APPROVED ||
      targetStatus === RegistrationStatus.REJECTED;

    if (currentStatus !== RegistrationStatus.PENDING || !validTarget) {
      throw new InvalidRegistrationStatusTransitionError(
        currentStatus,
        targetStatus,
      );
    }
  }
}
