/* eslint-disable @typescript-eslint/unbound-method */
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { ReportController } from './report.controller';

describe('ReportController anti-spam', () => {
  it('uses IP throttling while preserving optional authentication', () => {
    const method = ReportController.prototype.create;
    expect(Reflect.getMetadata(GUARDS_METADATA, method)).toEqual([
      OptionalJwtAuthGuard,
    ]);
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', method)).toBe(5);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', method)).toBe(60_000);
  });
});
