import {
  BadRequestException,
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { ApplicationErrorCode } from '../common/errors/application-error-code';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../prisma/prisma.service';
import { AccountTokenService } from './account-token.service';
import { AuthTokenService } from './auth-token.service';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ConfirmEmailChangeDto } from './dto/confirm-email-change.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { RequestEmailChangeDto } from './dto/request-email-change.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { GoogleIdentityService } from './google-identity.service';
import { PasswordHasher } from './password-hasher.service';
import type { JwtPayload } from './strategies/jwt.strategy';

const HOUR = 60 * 60 * 1000;
const EMAIL_TOKEN_TTL_MS = 24 * HOUR;
const RESET_TOKEN_TTL_MS = 15 * 60 * 1000;
const VERIFICATION_COOLDOWN_MS = 5 * 60 * 1000;
const RESET_COOLDOWN_MS = 60 * 1000;
const EMAIL_CHANGE_COOLDOWN_MS = 5 * 60 * 1000;
const FORGOT_PASSWORD_MESSAGE =
  'Nếu email tồn tại, bạn sẽ nhận được liên kết đặt lại mật khẩu';
const RESEND_VERIFICATION_MESSAGE =
  'Nếu tài khoản cần xác minh, email hướng dẫn sẽ được gửi';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokens: AuthTokenService,
    private readonly googleIdentity: GoogleIdentityService,
    private readonly accountTokens: AccountTokenService,
    private readonly email: EmailService,
  ) {}

  async register(dto: RegisterDto) {
    const email = this.normalizeEmail(dto.email);
    const existingUser = await this.prisma.user.findFirst({
      where: { OR: [{ email }, { pendingEmail: email }] },
      select: { id: true },
    });
    if (existingUser) throw new ConflictException('Email này đã được sử dụng');

    const { token, hash } = this.accountTokens.create();
    const hashedPassword = await this.passwordHasher.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash: hashedPassword,
        displayName: dto.displayName,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        currentAddress: dto.currentAddress,
        phoneNumber: dto.phoneNumber,
        gender: dto.gender,
        bio: dto.bio,
        emailVerifiedAt: null,
        emailVerificationTokenHash: hash,
        emailVerificationExpiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
      select: {
        id: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        birthDate: true,
        currentAddress: true,
        phoneNumber: true,
        gender: true,
        bio: true,
        role: true,
        emailVerifiedAt: true,
        createdAt: true,
      },
    });

    try {
      await this.email.sendVerification(
        user.email,
        user.displayName,
        this.frontendLink('/verify-email', token),
      );
    } catch {
      await this.runCleanupSafely(() =>
        this.clearVerificationToken(user.id, hash),
      );
      this.logger.warn('Verification email delivery failed after registration');
    }

    return {
      message:
        'Đăng ký thành công. Vui lòng kiểm tra email để xác minh tài khoản',
      user,
    };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    if (user.isLocked) {
      throw new UnauthorizedException(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin để biết thêm chi tiết',
      );
    }
    if (!(await this.passwordHasher.verify(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }
    if (!user.emailVerifiedAt) {
      throw new UnauthorizedException({
        message: 'Email chưa được xác minh',
        code: ApplicationErrorCode.EMAIL_NOT_VERIFIED,
      });
    }
    return this.createSession(user, 'Đăng nhập thành công');
  }

  async googleLogin(dto: GoogleLoginDto) {
    const identity = await this.googleIdentity.verifyCredential(dto.credential);
    const subjectUser = await this.prisma.user.findUnique({
      where: { googleSubject: identity.subject },
    });
    if (subjectUser) {
      const verifiedUser = subjectUser.emailVerifiedAt
        ? subjectUser
        : await this.prisma.user.update({
            where: { id: subjectUser.id },
            data: {
              emailVerifiedAt: new Date(),
              emailVerificationTokenHash: null,
              emailVerificationExpiresAt: null,
            },
          });
      return this.createSession(verifiedUser, 'Đăng nhập Google thành công');
    }

    const emailUser = await this.prisma.user.findUnique({
      where: { email: identity.email },
    });
    let user: User;
    if (emailUser) {
      if (emailUser.googleSubject) {
        throw new UnauthorizedException(
          'Tài khoản Google không khớp với tài khoản đã liên kết',
        );
      }
      if (!identity.canSafelyLinkByEmail) {
        throw new ConflictException(
          'Email đã được đăng ký. Hãy đăng nhập bằng mật khẩu trước khi liên kết Google',
        );
      }
      user = await this.prisma.user.update({
        where: { id: emailUser.id },
        data: {
          googleSubject: identity.subject,
          avatarUrl: emailUser.avatarUrl ?? identity.avatarUrl,
          emailVerifiedAt: emailUser.emailVerifiedAt ?? new Date(),
          emailVerificationTokenHash: null,
          emailVerificationExpiresAt: null,
        },
      });
    } else {
      user = await this.prisma.user.create({
        data: {
          email: identity.email,
          passwordHash: null,
          googleSubject: identity.subject,
          displayName: identity.displayName,
          avatarUrl: identity.avatarUrl,
          emailVerifiedAt: new Date(),
        },
      });
    }
    return this.createSession(user, 'Đăng nhập Google thành công');
  }

  async verifyEmail(dto: VerifyEmailDto) {
    const hash = this.accountTokens.hash(dto.token);
    const user = await this.prisma.user.findUnique({
      where: { emailVerificationTokenHash: hash },
    });
    if (!user || !user.emailVerificationTokenHash || user.emailVerifiedAt) {
      throw new BadRequestException(
        'Liên kết xác minh không hợp lệ hoặc đã được sử dụng',
      );
    }
    if (
      !this.accountTokens.matches(dto.token, user.emailVerificationTokenHash)
    ) {
      throw new BadRequestException('Liên kết xác minh không hợp lệ');
    }
    if (
      !user.emailVerificationExpiresAt ||
      user.emailVerificationExpiresAt <= new Date()
    ) {
      throw new BadRequestException('Liên kết xác minh đã hết hạn');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerifiedAt: new Date(),
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });
    return { message: 'Xác minh email thành công. Bạn có thể đăng nhập' };
  }

  async resendVerification(dto: ResendVerificationDto) {
    const startedAt = Date.now();
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) },
    });
    if (!user || user.emailVerifiedAt || !user.passwordHash) {
      return this.resendVerificationResponse(startedAt);
    }
    if (
      this.isWithinCooldown(
        user.emailVerificationExpiresAt,
        EMAIL_TOKEN_TTL_MS,
        VERIFICATION_COOLDOWN_MS,
      )
    ) {
      return this.resendVerificationResponse(startedAt);
    }

    const { token, hash } = this.accountTokens.create();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        emailVerificationTokenHash: hash,
        emailVerificationExpiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });
    try {
      await this.email.sendVerification(
        user.email,
        user.displayName,
        this.frontendLink('/verify-email', token),
        true,
      );
    } catch {
      await this.runCleanupSafely(() =>
        this.clearVerificationToken(user.id, hash),
      );
      this.logger.warn('Verification email redelivery failed');
    }
    return this.resendVerificationResponse(startedAt);
  }

  async refreshTokens(refreshToken: string) {
    let payload: JwtPayload;
    try {
      payload = await this.tokens.verifyRefresh(refreshToken);
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }
    if (
      typeof payload.sub !== 'string' ||
      typeof payload.tokenVersion !== 'number'
    ) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });
    if (
      !user ||
      !user.refreshToken ||
      user.isLocked ||
      user.tokenVersion !== payload.tokenVersion
    ) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }
    if (!(await this.passwordHasher.verify(refreshToken, user.refreshToken))) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }
    const tokens = await this.tokens.issuePair(
      user.id,
      user.email,
      user.role,
      user.tokenVersion,
    );
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: await this.passwordHasher.hash(tokens.refreshToken),
      },
    });
    return tokens;
  }

  async logout(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { refreshToken: null, tokenVersion: { increment: 1 } },
    });
    return { message: 'Đăng xuất thành công' };
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Tài khoản không tồn tại');
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Tài khoản này chưa thiết lập mật khẩu. Hãy tiếp tục đăng nhập bằng Google',
      );
    }
    if (
      !(await this.passwordHasher.verify(
        dto.currentPassword,
        user.passwordHash,
      ))
    ) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    if (await this.passwordHasher.verify(dto.newPassword, user.passwordHash)) {
      throw new BadRequestException(
        'Mật khẩu mới không được trùng với mật khẩu hiện tại',
      );
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: await this.passwordHasher.hash(dto.newPassword),
        refreshToken: null,
        tokenVersion: { increment: 1 },
      },
    });
    await this.sendSecurityEmail(() =>
      this.email.sendPasswordChanged(user.email, user.displayName),
    );
    return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại' };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const startedAt = Date.now();
    const user = await this.prisma.user.findUnique({
      where: { email: this.normalizeEmail(dto.email) },
    });
    if (
      user?.passwordHash &&
      !this.isWithinCooldown(
        user.resetPasswordExpires,
        RESET_TOKEN_TTL_MS,
        RESET_COOLDOWN_MS,
      )
    ) {
      const { token, hash } = this.accountTokens.create();
      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          resetPasswordToken: hash,
          resetPasswordExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
        },
      });
      try {
        await this.email.sendPasswordReset(
          user.email,
          user.displayName,
          this.frontendLink('/reset-password', token),
        );
      } catch {
        await this.runCleanupSafely(() => this.clearResetToken(user.id, hash));
        this.logger.warn('Password reset email delivery failed');
      }
    }
    await this.ensureMinimumDuration(startedAt, 250);
    return { message: FORGOT_PASSWORD_MESSAGE };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const hash = this.accountTokens.hash(dto.token);
    const user = await this.prisma.user.findUnique({
      where: { resetPasswordToken: hash },
    });
    if (!user || !user.resetPasswordToken) {
      throw new BadRequestException(
        'Liên kết đặt lại mật khẩu không hợp lệ hoặc đã được sử dụng',
      );
    }
    if (!this.accountTokens.matches(dto.token, user.resetPasswordToken)) {
      throw new BadRequestException('Liên kết đặt lại mật khẩu không hợp lệ');
    }
    if (!user.resetPasswordExpires || user.resetPasswordExpires <= new Date()) {
      throw new BadRequestException('Liên kết đặt lại mật khẩu đã hết hạn');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: await this.passwordHasher.hash(dto.newPassword),
        resetPasswordToken: null,
        resetPasswordExpires: null,
        refreshToken: null,
        tokenVersion: { increment: 1 },
      },
    });
    await this.sendSecurityEmail(() =>
      this.email.sendPasswordChanged(user.email, user.displayName),
    );
    return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại' };
  }

  async requestEmailChange(userId: string, dto: RequestEmailChangeDto) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('Tài khoản không tồn tại');
    if (!user.passwordHash) {
      throw new BadRequestException(
        'Tài khoản Google-only không thể đổi email bằng luồng mật khẩu. Hãy quản lý email trong tài khoản Google',
      );
    }
    if (
      !dto.currentPassword ||
      !(await this.passwordHasher.verify(
        dto.currentPassword,
        user.passwordHash,
      ))
    ) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    const newEmail = this.normalizeEmail(dto.newEmail);
    if (newEmail === user.email) {
      throw new BadRequestException('Email mới phải khác email hiện tại');
    }
    const conflict = await this.prisma.user.findFirst({
      where: {
        id: { not: user.id },
        OR: [{ email: newEmail }, { pendingEmail: newEmail }],
      },
      select: { id: true },
    });
    if (conflict) throw new ConflictException('Email mới đã được sử dụng');
    if (
      user.pendingEmail === newEmail &&
      this.isWithinCooldown(
        user.emailChangeExpiresAt,
        EMAIL_TOKEN_TTL_MS,
        EMAIL_CHANGE_COOLDOWN_MS,
      )
    ) {
      throw new HttpException(
        'Yêu cầu đổi email vừa được gửi. Vui lòng chờ trước khi thử lại',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    const { token, hash } = this.accountTokens.create();
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        pendingEmail: newEmail,
        emailChangeTokenHash: hash,
        emailChangeExpiresAt: new Date(Date.now() + EMAIL_TOKEN_TTL_MS),
      },
    });
    try {
      await this.email.sendEmailChangeConfirmation(
        newEmail,
        user.displayName,
        this.frontendLink('/confirm-email-change', token),
      );
    } catch {
      await this.runCleanupSafely(() =>
        this.clearEmailChangeToken(user.id, hash),
      );
      throw new HttpException(
        'Không thể gửi email xác nhận lúc này. Vui lòng thử lại',
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
    await this.sendSecurityEmail(() =>
      this.email.sendEmailChangeRequestedNotice(
        user.email,
        user.displayName,
        newEmail,
      ),
    );
    return { message: 'Đã gửi liên kết xác nhận tới email mới' };
  }

  async confirmEmailChange(dto: ConfirmEmailChangeDto) {
    const hash = this.accountTokens.hash(dto.token);
    const user = await this.prisma.user.findUnique({
      where: { emailChangeTokenHash: hash },
    });
    if (!user || !user.pendingEmail || !user.emailChangeTokenHash) {
      throw new BadRequestException(
        'Liên kết đổi email không hợp lệ hoặc đã được sử dụng',
      );
    }
    if (!this.accountTokens.matches(dto.token, user.emailChangeTokenHash)) {
      throw new BadRequestException('Liên kết đổi email không hợp lệ');
    }
    if (!user.emailChangeExpiresAt || user.emailChangeExpiresAt <= new Date()) {
      throw new BadRequestException('Liên kết đổi email đã hết hạn');
    }
    const pendingEmail = user.pendingEmail;
    const conflict = await this.prisma.user.findFirst({
      where: {
        id: { not: user.id },
        OR: [{ email: pendingEmail }, { pendingEmail }],
      },
      select: { id: true },
    });
    if (conflict) throw new ConflictException('Email mới đã được sử dụng');

    const oldEmail = user.email;
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        email: pendingEmail,
        emailVerifiedAt: new Date(),
        pendingEmail: null,
        emailChangeTokenHash: null,
        emailChangeExpiresAt: null,
        refreshToken: null,
        tokenVersion: { increment: 1 },
      },
    });
    await Promise.all([
      this.sendSecurityEmail(() =>
        this.email.sendEmailChanged(
          oldEmail,
          user.displayName,
          oldEmail,
          pendingEmail,
        ),
      ),
      this.sendSecurityEmail(() =>
        this.email.sendEmailChanged(
          pendingEmail,
          user.displayName,
          oldEmail,
          pendingEmail,
        ),
      ),
    ]);
    return { message: 'Đổi email thành công. Vui lòng đăng nhập lại' };
  }

  private async createSession(user: User, message: string) {
    if (user.isLocked) {
      throw new UnauthorizedException(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin để biết thêm chi tiết',
      );
    }
    const tokens = await this.tokens.issuePair(
      user.id,
      user.email,
      user.role,
      user.tokenVersion,
    );
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        refreshToken: await this.passwordHasher.hash(tokens.refreshToken),
      },
    });
    return {
      message,
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        birthDate: user.birthDate,
        currentAddress: user.currentAddress,
        phoneNumber: user.phoneNumber,
        gender: user.gender,
        bio: user.bio,
        role: user.role,
        emailVerifiedAt: user.emailVerifiedAt,
      },
      ...tokens,
    };
  }

  private frontendLink(path: string, token: string): string {
    const frontendUrl = this.configService.getOrThrow<string>('FRONTEND_URL');
    const url = new URL(
      path,
      frontendUrl.endsWith('/') ? frontendUrl : `${frontendUrl}/`,
    );
    url.searchParams.set('token', token);
    return url.toString();
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private isWithinCooldown(
    expiresAt: Date | null,
    ttlMs: number,
    cooldownMs: number,
  ): boolean {
    if (!expiresAt) return false;
    return Date.now() - (expiresAt.getTime() - ttlMs) < cooldownMs;
  }

  private async clearVerificationToken(userId: string, hash: string) {
    await this.prisma.user.updateMany({
      where: { id: userId, emailVerificationTokenHash: hash },
      data: {
        emailVerificationTokenHash: null,
        emailVerificationExpiresAt: null,
      },
    });
  }

  private async clearResetToken(userId: string, hash: string) {
    await this.prisma.user.updateMany({
      where: { id: userId, resetPasswordToken: hash },
      data: { resetPasswordToken: null, resetPasswordExpires: null },
    });
  }

  private async clearEmailChangeToken(userId: string, hash: string) {
    await this.prisma.user.updateMany({
      where: { id: userId, emailChangeTokenHash: hash },
      data: {
        pendingEmail: null,
        emailChangeTokenHash: null,
        emailChangeExpiresAt: null,
      },
    });
  }

  private async sendSecurityEmail(send: () => Promise<void>): Promise<void> {
    try {
      await send();
    } catch {
      this.logger.warn('Security notification email delivery failed');
    }
  }

  private async runCleanupSafely(cleanup: () => Promise<void>): Promise<void> {
    try {
      await cleanup();
    } catch {
      this.logger.warn('Token cleanup after email delivery failure failed');
    }
  }

  private async ensureMinimumDuration(startedAt: number, durationMs: number) {
    const remaining = durationMs - (Date.now() - startedAt);
    if (remaining > 0) {
      await new Promise((resolve) => setTimeout(resolve, remaining));
    }
  }

  private async resendVerificationResponse(startedAt: number) {
    await this.ensureMinimumDuration(startedAt, 250);
    return { message: RESEND_VERIFICATION_MESSAGE };
  }
}
