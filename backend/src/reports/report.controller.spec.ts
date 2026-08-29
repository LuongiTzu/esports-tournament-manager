/* eslint-disable @typescript-eslint/unbound-method */
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import { ReportController } from './report.controller';

describe('ReportController anti-spam', () => {
  it('requires a verified account while preserving IP throttling', () => {
    const method = ReportController.prototype.create;
    expect(Reflect.getMetadata(GUARDS_METADATA, method)).toEqual([
      JwtAuthGuard,
      EmailVerifiedGuard,
    ]);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', method)).toBe(5);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', method)).toBe(60_000);
  });
});
