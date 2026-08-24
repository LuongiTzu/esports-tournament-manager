import { RegistrationStatus } from '@prisma/client';
import { TeamReviewPolicy } from './team-review.policy';

describe('TeamReviewPolicy', () => {
  const policy = new TeamReviewPolicy();

  it.each([RegistrationStatus.APPROVED, RegistrationStatus.REJECTED])(
    'allows PENDING -> %s',
    (target) => {
      expect(() =>
        policy.assertCanReview(RegistrationStatus.PENDING, target),
      ).not.toThrow();
    },
  );

  it.each([
    [RegistrationStatus.PENDING, RegistrationStatus.PENDING],
    [RegistrationStatus.APPROVED, RegistrationStatus.APPROVED],
    [RegistrationStatus.APPROVED, RegistrationStatus.REJECTED],
    [RegistrationStatus.REJECTED, RegistrationStatus.REJECTED],
    [RegistrationStatus.REJECTED, RegistrationStatus.APPROVED],
  ])('rejects %s -> %s', (current, target) => {
    expect(() => policy.assertCanReview(current, target)).toThrow(
      expect.objectContaining({
        code: 'INVALID_REGISTRATION_STATUS_TRANSITION',
        currentStatus: current,
        targetStatus: target,
      }),
    );
  });
});
