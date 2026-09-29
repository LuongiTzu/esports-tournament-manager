import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCookieAuth,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { GoogleLoginDto } from './dto/google-login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './strategies/jwt.strategy';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { ResendVerificationDto } from './dto/resend-verification.dto';
import { RequestEmailChangeDto } from './dto/request-email-change.dto';
import { ConfirmEmailChangeDto } from './dto/confirm-email-change.dto';
import { RefreshCookieService } from './refresh-cookie.service';

const REGISTER_THROTTLE = {
  limit: () => (process.env.NODE_ENV === 'production' ? 3 : 20),
  ttl: () => (process.env.NODE_ENV === 'production' ? 60 * 60_000 : 60_000),
};

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly refreshCookie: RefreshCookieService,
  ) {}

  /**
   * POST /api/auth/register
   * Đăng ký tài khoản mới (mặc định role SIGNED_UP_USER)
   */
  @Post('register')
  @Throttle({ default: REGISTER_THROTTLE })
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('verify-email')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác minh email bằng token một lần' })
  verifyEmail(@Body() dto: VerifyEmailDto) {
    return this.authService.verifyEmail(dto);
  }

  @Post('resend-verification')
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Gửi lại email xác minh với response chống dò email',
  })
  resendVerification(@Body() dto: ResendVerificationDto) {
    return this.authService.resendVerification(dto);
  }

  /**
   * POST /api/auth/login
   * Đăng nhập, nhận access_token và refresh_token
   */
  @Post('login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.refreshCookie.assertTrustedOrigin(request);
    return this.createBrowserSession(
      await this.authService.login(dto),
      response,
    );
  }

  /**
   * POST /api/auth/google
   * Xác minh Google ID token rồi phát token nội bộ của hệ thống
   */
  @Post('google')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @HttpCode(HttpStatus.OK)
  async googleLogin(
    @Body() dto: GoogleLoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.refreshCookie.assertTrustedOrigin(request);
    return this.createBrowserSession(
      await this.authService.googleLogin(dto),
      response,
    );
  }

  /**
   * POST /api/auth/refresh
   * Dùng refresh token HttpOnly cookie để lấy access token mới
   */
  @Post('refresh')
  @ApiCookieAuth()
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    try {
      const result = await this.authService.refreshTokens(
        this.refreshCookie.read(request),
      );
      this.refreshCookie.set(response, result.refreshToken);
      return { accessToken: result.accessToken };
    } catch (error) {
      this.refreshCookie.clear(response);
      throw error;
    }
  }

  /**
   * POST /api/auth/logout
   * Đăng xuất, xoá refresh token trong DB
   */
  @Post('logout')
  @ApiCookieAuth()
  @HttpCode(HttpStatus.OK)
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    let refreshToken: string | undefined;
    try {
      refreshToken = this.refreshCookie.read(request);
    } catch (error) {
      if (!(error instanceof UnauthorizedException)) throw error;
      // Logout remains idempotent when the session cookie is missing/expired.
    }
    const result = await this.authService.logout(refreshToken);
    this.refreshCookie.clear(response);
    return result;
  }

  /**
   * GET /api/auth/me
   * Lấy thông tin user hiện tại (cần đăng nhập)
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  getMe(@CurrentUser() user: AuthenticatedUser) {
    return { user };
  }

  /**
   * POST /api/auth/change-password
   * Đổi mật khẩu khi đã đăng nhập — vô hiệu mọi token cũ
   */
  @Post('change-password')
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async changePassword(
    @CurrentUser('id') userId: string,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, dto);
  }

  /**
   * POST /api/auth/forgot-password
   * Yêu cầu đặt lại mật khẩu (gửi email chứa reset token)
   */
  @Post('forgot-password')
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto);
  }

  /**
   * POST /api/auth/reset-password
   * Đặt lại mật khẩu bằng reset token nhận từ email
   */
  @Post('reset-password')
  @Throttle({ default: { limit: 5, ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto);
  }

  @Post('request-email-change')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @Throttle({ default: { limit: 3, ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Yêu cầu đổi email và gửi xác nhận tới email mới' })
  requestEmailChange(
    @CurrentUser('id') userId: string,
    @Body() dto: RequestEmailChangeDto,
  ) {
    return this.authService.requestEmailChange(userId, dto);
  }

  @Post('confirm-email-change')
  @Throttle({ default: { limit: 10, ttl: 15 * 60_000 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Xác nhận email mới bằng token một lần' })
  confirmEmailChange(@Body() dto: ConfirmEmailChangeDto) {
    return this.authService.confirmEmailChange(dto);
  }

  private createBrowserSession<
    T extends { accessToken: string; refreshToken: string },
  >(session: T, response: Response): Omit<T, 'refreshToken'> {
    this.refreshCookie.set(response, session.refreshToken);
    const { refreshToken: _refreshToken, ...publicSession } = session;
    return publicSession;
  }
}
