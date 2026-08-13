/* eslint-disable @typescript-eslint/unbound-method */
import { AuthController } from '../auth/auth.controller';
import { CommentController } from '../comments/comment.controller';
import { ReportController } from '../reports/report.controller';

describe('rate limit decorator integration', () => {
  it.each([
    [AuthController.prototype.login, 5, 60_000],
    [AuthController.prototype.register, 3, 3_600_000],
    [ReportController.prototype.create, 5, 60_000],
    [CommentController.prototype.create, 10, 60_000],
  ])('defines a strict endpoint limit', (handler, limit, ttl) => {
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(limit);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(ttl);
  });
});
