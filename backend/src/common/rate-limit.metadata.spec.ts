/* eslint-disable @typescript-eslint/unbound-method */
import { AuthController } from '../auth/auth.controller';
import { CommentController } from '../comments/comment.controller';
import { ReportController } from '../reports/report.controller';

type ResolvableNumber = number | (() => number | Promise<number>);

async function resolveMetadata(
  key: string,
  handler: (...args: never[]) => unknown,
) {
  const value = Reflect.getMetadata(key, handler) as ResolvableNumber;
  return typeof value === 'function' ? value() : value;
}

describe('rate limit decorator integration', () => {
  it.each([
    [AuthController.prototype.login, 5, 60_000],
    [AuthController.prototype.resendVerification, 3, 900_000],
    [AuthController.prototype.forgotPassword, 3, 900_000],
    [AuthController.prototype.requestEmailChange, 3, 900_000],
    [ReportController.prototype.create, 5, 60_000],
    [CommentController.prototype.create, 10, 60_000],
  ])('defines a strict endpoint limit', (handler, limit, ttl) => {
    expect(Reflect.getMetadata('THROTTLER:LIMITdefault', handler)).toBe(limit);
    expect(Reflect.getMetadata('THROTTLER:TTLdefault', handler)).toBe(ttl);
  });

  it('keeps registration strict in production and practical during local development', async () => {
    const originalNodeEnv = process.env.NODE_ENV;
    try {
      process.env.NODE_ENV = 'development';
      await expect(
        resolveMetadata(
          'THROTTLER:LIMITdefault',
          AuthController.prototype.register,
        ),
      ).resolves.toBe(20);
      await expect(
        resolveMetadata(
          'THROTTLER:TTLdefault',
          AuthController.prototype.register,
        ),
      ).resolves.toBe(60_000);

      process.env.NODE_ENV = 'production';
      await expect(
        resolveMetadata(
          'THROTTLER:LIMITdefault',
          AuthController.prototype.register,
        ),
      ).resolves.toBe(3);
      await expect(
        resolveMetadata(
          'THROTTLER:TTLdefault',
          AuthController.prototype.register,
        ),
      ).resolves.toBe(3_600_000);
    } finally {
      if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = originalNodeEnv;
    }
  });
});
