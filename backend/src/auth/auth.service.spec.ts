import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';

jest.mock('bcrypt', () => ({
  compare: jest.fn(),
  hash: jest.fn(),
}));

const comparePassword = bcrypt.compare as unknown as jest.MockedFunction<
  (value: string, hash: string) => Promise<boolean>
>;
const hashValue = bcrypt.hash as unknown as jest.MockedFunction<
  (value: string, rounds: number) => Promise<string>
>;

const GENERIC_FORGOT_MESSAGE =
  'Nếu email tồn tại, bạn sẽ nhận được liên kết đặt lại mật khẩu';

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'password-hash',
    displayName: 'User',
    avatarUrl: null,
    birthDate: null,
    currentAddress: null,
    phoneNumber: null,
    gender: null,
    bio: null,
    role: Role.SIGNED_UP_USER,
    isLocked: false,
    tokenVersion: 3,
    refreshToken: 'stored-refresh-hash',
    resetPasswordToken: null,
    resetPasswordExpires: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function harness(environment: string | null = 'test') {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };
  const jwt = {
    verifyAsync: jest.fn(),
    signAsync: jest
      .fn()
      .mockImplementation((_payload: unknown, options: { secret: string }) =>
        Promise.resolve(
          options.secret === 'access-secret'
            ? 'new-access-token'
            : options.secret === 'refresh-secret'
              ? 'new-refresh-token'
              : 'raw-reset-token',
        ),
      ),
  };
  const values: Record<string, string | undefined> = {
    NODE_ENV: environment ?? undefined,
    JWT_SECRET: 'access-secret',
    JWT_REFRESH_SECRET: 'refresh-secret',
    JWT_RESET_SECRET: 'reset-secret',
    JWT_EXPIRES_IN: '15m',
    JWT_REFRESH_EXPIRES_IN: '7d',
  };
  const config = {
    get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
    getOrThrow: jest.fn((key: string) => {
      const value = values[key];
      if (value === undefined) throw new Error(`Missing ${key}`);
      return value;
    }),
  };

  return {
    service: new AuthService(
      prisma as unknown as PrismaService,
      jwt as unknown as JwtService,
      config as unknown as ConfigService,
    ),
    prisma,
    jwt,
  };
}

describe('AuthService refresh security', () => {
  beforeEach(() => {
    comparePassword.mockReset().mockResolvedValue(true);
    hashValue.mockReset().mockResolvedValue('rotated-hash');
  });

  it('rotates a valid current refresh token with the established shape', async () => {
    const { service, prisma, jwt } = harness();
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', tokenVersion: 3 });
    prisma.user.findUnique.mockResolvedValue(user());

    await expect(service.refreshTokens('current-refresh')).resolves.toEqual({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    });
    expect(bcrypt.compare).toHaveBeenCalledWith(
      'current-refresh',
      'stored-refresh-hash',
    );
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { refreshToken: 'rotated-hash' },
    });
  });

  it.each([
    ['locked account', user({ isLocked: true }), 3],
    ['stale tokenVersion', user({ tokenVersion: 4 }), 3],
    ['missing account', null, 3],
  ])(
    'rejects a %s before issuing replacement tokens',
    async (_case, row, tokenVersion) => {
      const { service, prisma, jwt } = harness();
      jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', tokenVersion });
      prisma.user.findUnique.mockResolvedValue(row);

      await expect(
        service.refreshTokens('refresh-token'),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(jwt.signAsync).not.toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    },
  );

  it('rejects an invalid or wrong-secret token before loading a user', async () => {
    const { service, prisma, jwt } = harness();
    jwt.verifyAsync.mockRejectedValue(new Error('invalid signature'));

    await expect(
      service.refreshTokens('access-or-malformed-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a malformed verified payload', async () => {
    const { service, prisma, jwt } = harness();
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1' });

    await expect(
      service.refreshTokens('malformed-token'),
    ).rejects.toBeInstanceOf(UnauthorizedException);
    expect(prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('rejects a refresh token that does not match the stored hash', async () => {
    const { service, prisma, jwt } = harness();
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1', tokenVersion: 3 });
    prisma.user.findUnique.mockResolvedValue(user());
    comparePassword.mockResolvedValue(false);

    await expect(service.refreshTokens('other-refresh')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
    expect(jwt.signAsync).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });
});

describe('AuthService password reset exposure', () => {
  beforeEach(() => {
    comparePassword.mockReset().mockResolvedValue(true);
    hashValue.mockReset().mockResolvedValue('stored-reset-hash');
  });

  it('persists a hashed reset token but does not expose the raw token in production', async () => {
    const { service, prisma } = harness('production');
    prisma.user.findUnique.mockResolvedValue(user());
    const before = Date.now();

    const response = await service.forgotPassword({
      email: 'user@example.com',
    });

    expect(response).toEqual({ message: GENERIC_FORGOT_MESSAGE });
    expect(response).not.toHaveProperty('resetToken');
    expect(response).not.toHaveProperty('stored-reset-hash');
    expect(bcrypt.hash).toHaveBeenCalledWith('raw-reset-token', 10);
    const update = prisma.user.update.mock.calls[0][0];
    expect(update.where).toEqual({ id: 'user-1' });
    expect(update.data.resetPasswordToken).toBe('stored-reset-hash');
    expect(update.data.resetPasswordExpires.getTime()).toBeGreaterThanOrEqual(
      before + 15 * 60 * 1000,
    );
    expect(update.data.resetPasswordExpires.getTime()).toBeLessThanOrEqual(
      before + 15 * 60 * 1000 + 1000,
    );
  });

  it('fails safe when NODE_ENV is not configured', async () => {
    const { service, prisma } = harness(null);
    prisma.user.findUnique.mockResolvedValue(user());

    const response = await service.forgotPassword({
      email: 'user@example.com',
    });

    expect(response).toEqual({ message: GENERIC_FORGOT_MESSAGE });
    expect(response).not.toHaveProperty('resetToken');
  });

  it.each(['development', 'test'])(
    'keeps an intentional local reset workflow in %s',
    async (environment) => {
      const { service, prisma } = harness(environment);
      prisma.user.findUnique.mockResolvedValue(user());

      await expect(
        service.forgotPassword({ email: 'user@example.com' }),
      ).resolves.toEqual({
        message: GENERIC_FORGOT_MESSAGE,
        resetToken: 'raw-reset-token',
        expiresIn: '15m',
      });
    },
  );

  it('uses the same production response for an unknown email', async () => {
    const { service, prisma, jwt } = harness('production');
    prisma.user.findUnique.mockResolvedValue(null);

    await expect(
      service.forgotPassword({ email: 'missing@example.com' }),
    ).resolves.toEqual({ message: GENERIC_FORGOT_MESSAGE });
    expect(jwt.signAsync).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('still accepts and consumes a legitimate unexpired reset token', async () => {
    const { service, prisma, jwt } = harness('production');
    jwt.verifyAsync.mockResolvedValue({ sub: 'user-1' });
    prisma.user.findUnique.mockResolvedValue(
      user({
        resetPasswordToken: 'stored-reset-hash',
        resetPasswordExpires: new Date(Date.now() + 60_000),
      }),
    );
    hashValue.mockResolvedValue('new-password-hash');

    await expect(
      service.resetPassword({
        token: 'raw-reset-token',
        newPassword: 'Pass123',
      }),
    ).resolves.toEqual({
      message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại',
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        passwordHash: 'new-password-hash',
        resetPasswordToken: null,
        resetPasswordExpires: null,
        refreshToken: null,
        tokenVersion: { increment: 1 },
      },
    });
  });
});
