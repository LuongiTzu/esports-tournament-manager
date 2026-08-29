/* eslint-disable @typescript-eslint/unbound-method */
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import { NotificationController } from './notification.controller';

describe('NotificationController security', () => {
  it('protects manual tournament notification with organizer ownership', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        NotificationController.prototype.createForTournament,
      ),
    ).toEqual([JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard]);
  });
});
