import {
  BadRequestException,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountTokenService } from './account-token.service';
import { AuthService } from './auth.service';
import { AuthTokenService } from './auth-token.service';
import { GoogleIdentityService } from './google-identity.service';
import { PasswordHasher } from './password-hasher.service';

const GENERIC_FORGOT_MESSAGE =
  'Nếu email tồn tại, bạn sẽ nhận được liên kết đặt lại mật khẩu';
const GENERIC_RESEND_MESSAGE =
  'Nếu tài khoản cần xác minh, email hướng dẫn sẽ được gửi';

function user(overrides: Record<string, unknown> = {}) {
  return {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'password-hash',
    googleSubject: null,
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
    emailVerifiedAt: new Date('2026-01-01T00:00:00.000Z'),
    emailVerificationTokenHash: null,
    emailVerificationExpiresAt: null,
    pendingEmail: null,
    emailChangeTokenHash: null,
    emailChangeExpiresAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function harness() {
  const prisma = {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const passwordHasher = {
    hash: jest.fn().mockResolvedValue('hashed-value'),
    verify: jest.fn().mockResolvedValue(true),
  };
  const tokens = {
    issuePair: jest.fn().mockResolvedValue({
      accessToken: 'new-access-token',
      refreshToken: 'new-refresh-token',
    }),
    verifyRefresh: jest.fn(),
  };
  const googleIdentity = { verifyCredential: jest.fn() };
  const email = {
    sendVerification: jest.fn().mockResolvedValue(undefined),
    sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    sendPasswordChanged: jest.fn().mockResolvedValue(undefined),
    sendEmailChangeConfirmation: jest.fn().mockResolvedValue(undefined),
    sendEmailChangeRequestedNotice: jest.fn().mockResolvedValue(undefined),
    sendEmailChanged: jest.fn().mockResolvedValue(undefined),
  };
  const config = {
    getOrThrow: jest.fn((key: string) => {
      if (key === 'FRONTEND_URL') return 'http://localhost:3000';
      throw new Error(`Unexpected config ${key}`);
    }),
  };
  const accountTokens = new AccountTokenService();
  const service = new AuthService(
    prisma as unknown as PrismaService,
    config as unknown as ConfigService,
    passwordHasher as unknown as PasswordHasher,
    tokens as unknown as AuthTokenService,
    googleIdentity as unknown as GoogleIdentityService,
    accountTokens,
    email as unknown as EmailService,
  );
  return {
    service,
    prisma,
    passwordHasher,
    tokens,
    googleIdentity,
    accountTokens,
    email,
  };
}

describe('AuthService email verification', () => {
  it('registers an unverified account, stores only a SHA-256 hash and emails the raw token', async () => {
    const { service, prisma, email } = harness();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve(user({ ...data, emailVerifiedAt: null })),
    );

    const result = await service.register({
      email: '  USER@EXAMPLE.COM ',
      password: 'Password123',
      displayName: 'User',
    });

    const createData = prisma.user.create.mock.calls[0][0].data;
    expect(createData.email).toBe('user@example.com');
    expect(createData.emailVerifiedAt).toBeNull();
    expect(createData.emailVerificationTokenHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createData.emailVerificationExpiresAt.getTime()).toBeGreaterThan(
      Date.now() + 23 * 60 * 60 * 1000,
    );
    expect(email.sendVerification).toHaveBeenCalledWith(
      'user@example.com',
      'User',
      expect.stringMatching(/^http:\/\/localhost:3000\/verify-email\?token=/),
    );
    expect(result).not.toHaveProperty('token');
    expect(JSON.stringify(result)).not.toContain(
      new URL(
        jest.mocked(email.sendVerification).mock.calls[0][2],
      ).searchParams.get('token'),
    );
  });

  it('keeps the account unverified and makes resend immediately possible after delivery failure', async () => {
    const { service, prisma, email } = harness();
    prisma.user.findFirst.mockResolvedValue(null);
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve(user({ ...data, emailVerifiedAt: null })),
    );
    email.sendVerification.mockRejectedValue(new Error('smtp secret omitted'));

    await expect(
      service.register({
        email: 'user@example.com',
        password: 'Password123',
        displayName: 'User',
      }),
    ).resolves.toMatchObject({ user: { emailVerifiedAt: null } });
    expect(prisma.user.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
        },
      }),
    );
  });

  it('blocks a correct password until email verification and exposes a stable error code', async () => {
    const { service, prisma } = harness();
    prisma.user.findUnique.mockResolvedValue(user({ emailVerifiedAt: null }));

    await expect(
      service.login({ email: 'user@example.com', password: 'Password123' }),
    ).rejects.toMatchObject({
      response: {
        message: 'Email chưa được xác minh',
        code: 'EMAIL_NOT_VERIFIED',
      },
    });
  });

  it('verifies a valid token once and clears token state', async () => {
    const { service, prisma, accountTokens } = harness();
    const token = accountTokens.create();
    prisma.user.findUnique.mockResolvedValue(
      user({
        emailVerifiedAt: null,
        emailVerificationTokenHash: token.hash,
        emailVerificationExpiresAt: new Date(Date.now() + 60_000),
      }),
    );

    await expect(service.verifyEmail({ token: token.token })).resolves.toEqual({
      message: 'Xác minh email thành công. Bạn có thể đăng nhập',
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        emailVerifiedAt: expect.any(Date),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });
  });

  it.each([
    ['wrong or used', null],
    [
      'expired',
      user({
        emailVerifiedAt: null,
        emailVerificationTokenHash: 'HASH',
        emailVerificationExpiresAt: new Date(Date.now() - 1),
      }),
    ],
  ])('rejects a %s verification token', async (_case, row) => {
    const { service, prisma, accountTokens } = harness();
    const token = accountTokens.create();
    prisma.user.findUnique.mockResolvedValue(
      row ? { ...row, emailVerificationTokenHash: token.hash } : row,
    );
    await expect(
      service.verifyEmail({ token: token.token }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('uses the same resend response for existing and unknown emails', async () => {
    const existing = harness();
    existing.prisma.user.findUnique.mockResolvedValue(
      user({ emailVerifiedAt: null, emailVerificationExpiresAt: null }),
    );
    await expect(
      existing.service.resendVerification({ email: 'user@example.com' }),
    ).resolves.toEqual({ message: GENERIC_RESEND_MESSAGE });

    const missing = harness();
    missing.prisma.user.findUnique.mockResolvedValue(null);
    await expect(
      missing.service.resendVerification({ email: 'missing@example.com' }),
    ).resolves.toEqual({ message: GENERIC_RESEND_MESSAGE });
  });
});

describe('AuthService Google verification', () => {
  it('creates a Google-only account as verified', async () => {
    const { service, prisma, googleIdentity } = harness();
    googleIdentity.verifyCredential.mockResolvedValue({
      subject: 'google-subject',
      email: 'player@gmail.com',
      displayName: 'Google Player',
      avatarUrl: null,
      canSafelyLinkByEmail: true,
    });
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.user.create.mockImplementation(({ data }) =>
      Promise.resolve(user({ ...data })),
    );

    await service.googleLogin({ credential: 'google-jwt' });
    expect(prisma.user.create.mock.calls[0][0].data.emailVerifiedAt).toEqual(
      expect.any(Date),
    );
  });

  it('marks a safely linked local account as verified', async () => {
    const { service, prisma, googleIdentity } = harness();
    googleIdentity.verifyCredential.mockResolvedValue({
      subject: 'google-subject',
      email: 'user@example.com',
      displayName: 'User',
      avatarUrl: null,
      canSafelyLinkByEmail: true,
    });
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(user({ emailVerifiedAt: null }));
    prisma.user.update.mockResolvedValue(
      user({ googleSubject: 'google-subject' }),
    );

    await service.googleLogin({ credential: 'google-jwt' });
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({
      googleSubject: 'google-subject',
      emailVerifiedAt: expect.any(Date),
      emailVerificationTokenHash: null,
    });
  });
});

describe('AuthService password recovery and notifications', () => {
  it('emails a 15-minute reset link without returning the raw token in any environment', async () => {
    const { service, prisma, email } = harness();
    prisma.user.findUnique.mockResolvedValue(
      user({ resetPasswordExpires: null }),
    );

    const response = await service.forgotPassword({
      email: 'user@example.com',
    });
    expect(response).toEqual({ message: GENERIC_FORGOT_MESSAGE });
    expect(response).not.toHaveProperty('resetToken');
    expect(prisma.user.update.mock.calls[0][0].data.resetPasswordToken).toMatch(
      /^[a-f0-9]{64}$/,
    );
    expect(email.sendPasswordReset).toHaveBeenCalledWith(
      'user@example.com',
      'User',
      expect.stringMatching(/^http:\/\/localhost:3000\/reset-password\?token=/),
    );
  });

  it('consumes reset state, invalidates sessions and sends a security alert', async () => {
    const { service, prisma, accountTokens, email, passwordHasher } = harness();
    const token = accountTokens.create();
    prisma.user.findUnique.mockResolvedValue(
      user({
        resetPasswordToken: token.hash,
        resetPasswordExpires: new Date(Date.now() + 60_000),
      }),
    );
    passwordHasher.hash.mockResolvedValue('new-password-hash');

    await service.resetPassword({ token: token.token, newPassword: 'Pass123' });
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
    expect(email.sendPasswordChanged).toHaveBeenCalledWith(
      'user@example.com',
      'User',
    );
  });

  it('does not roll back a completed password change when alert delivery fails', async () => {
    const { service, prisma, passwordHasher, email } = harness();
    prisma.user.findUnique.mockResolvedValue(user());
    passwordHasher.verify
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);
    email.sendPasswordChanged.mockRejectedValue(new Error('delivery failed'));

    await expect(
      service.changePassword('user-1', {
        currentPassword: 'Current123',
        newPassword: 'Next123',
      }),
    ).resolves.toMatchObject({
      message: expect.stringContaining('thành công'),
    });
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('does not roll back a completed reset when alert delivery fails', async () => {
    const { service, prisma, accountTokens, email } = harness();
    const token = accountTokens.create();
    prisma.user.findUnique.mockResolvedValue(
      user({
        resetPasswordToken: token.hash,
        resetPasswordExpires: new Date(Date.now() + 60_000),
      }),
    );
    email.sendPasswordChanged.mockRejectedValue(new Error('delivery failed'));

    await expect(
      service.resetPassword({ token: token.token, newPassword: 'Pass123' }),
    ).resolves.toMatchObject({
      message: expect.stringContaining('thành công'),
    });
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          resetPasswordToken: null,
          refreshToken: null,
          tokenVersion: { increment: 1 },
        }),
      }),
    );
  });
});

describe('AuthService email change', () => {
  it('requires a password, stores pending email and notifies old and new addresses', async () => {
    const { service, prisma, email } = harness();
    prisma.user.findUnique.mockResolvedValue(user());
    prisma.user.findFirst.mockResolvedValue(null);

    await service.requestEmailChange('user-1', {
      newEmail: ' NEW@EXAMPLE.COM ',
      currentPassword: 'Password123',
    });
    expect(prisma.user.update.mock.calls[0][0].data).toMatchObject({
      pendingEmail: 'new@example.com',
      emailChangeTokenHash: expect.stringMatching(/^[a-f0-9]{64}$/),
    });
    expect(email.sendEmailChangeConfirmation).toHaveBeenCalledWith(
      'new@example.com',
      'User',
      expect.stringContaining('/confirm-email-change?token='),
    );
    expect(email.sendEmailChangeRequestedNotice).toHaveBeenCalledWith(
      'user@example.com',
      'User',
      'new@example.com',
    );
  });

  it('confirms the pending email, invalidates sessions and notifies both addresses', async () => {
    const { service, prisma, accountTokens, email } = harness();
    const token = accountTokens.create();
    prisma.user.findUnique.mockResolvedValue(
      user({
        pendingEmail: 'new@example.com',
        emailChangeTokenHash: token.hash,
        emailChangeExpiresAt: new Date(Date.now() + 60_000),
      }),
    );
    prisma.user.findFirst.mockResolvedValue(null);

    await service.confirmEmailChange({ token: token.token });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: {
        email: 'new@example.com',
        emailVerifiedAt: expect.any(Date),
        pendingEmail: null,
        emailChangeTokenHash: null,
        emailChangeExpiresAt: null,
        refreshToken: null,
        tokenVersion: { increment: 1 },
      },
    });
    expect(email.sendEmailChanged).toHaveBeenCalledTimes(2);
  });

  it('rejects duplicate primary/pending emails and Google-only accounts', async () => {
    const duplicate = harness();
    duplicate.prisma.user.findUnique.mockResolvedValue(user());
    duplicate.prisma.user.findFirst.mockResolvedValue({ id: 'other' });
    await expect(
      duplicate.service.requestEmailChange('user-1', {
        newEmail: 'taken@example.com',
        currentPassword: 'Password123',
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const googleOnly = harness();
    googleOnly.prisma.user.findUnique.mockResolvedValue(
      user({ passwordHash: null, googleSubject: 'google-subject' }),
    );
    await expect(
      googleOnly.service.requestEmailChange('user-1', {
        newEmail: 'new@example.com',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('AuthService lock and refresh invariants', () => {
  it('checks account lock before verification on password login', async () => {
    const { service, prisma } = harness();
    prisma.user.findUnique.mockResolvedValue(
      user({ isLocked: true, emailVerifiedAt: null }),
    );
    await expect(
      service.login({ email: 'user@example.com', password: 'Password123' }),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
