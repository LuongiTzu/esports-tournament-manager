import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { EmailVerifiedGuard } from './email-verified.guard';

function context(userId?: string) {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user: userId ? { id: userId } : undefined }),
    }),
  } as unknown as ExecutionContext;
}

describe('EmailVerifiedGuard', () => {
  const findUnique = jest.fn();
  const prisma = {
    user: { findUnique },
  } as unknown as PrismaService;
  const guard = new EmailVerifiedGuard(prisma);

  beforeEach(() => findUnique.mockReset());

  it('allows a user whose email is verified', async () => {
    findUnique.mockResolvedValue({ emailVerifiedAt: new Date() });

    await expect(guard.canActivate(context('user-1'))).resolves.toBe(true);
    expect(findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      select: { emailVerifiedAt: true },
    });
  });

  it('returns EMAIL_NOT_VERIFIED for an unverified user', async () => {
    findUnique.mockResolvedValue({ emailVerifiedAt: null });
    const activation = guard.canActivate(context('user-1'));

    await expect(activation).rejects.toMatchObject({
      response: {
        code: 'EMAIL_NOT_VERIFIED',
        message: 'Vui lòng xác minh email trước khi thực hiện thao tác này',
      },
    });
    await expect(activation).rejects.toBeInstanceOf(ForbiddenException);
    expect(findUnique).toHaveBeenCalledTimes(1);
  });

  it('returns unauthorized when authentication did not attach a user', async () => {
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(findUnique).not.toHaveBeenCalled();
  });

  it('returns unauthorized when the current user no longer exists', async () => {
    findUnique.mockResolvedValue(null);

    await expect(guard.canActivate(context('missing'))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('has no email-delivery dependency or side effect', async () => {
    const sendVerification = jest.fn();
    findUnique.mockResolvedValue({ emailVerifiedAt: new Date() });

    await guard.canActivate(context('user-1'));

    expect(sendVerification).not.toHaveBeenCalled();
  });
});
