import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { CurrentUser } from './decorators/current-user.decorator';
import { AuthenticatedUser } from './strategies/jwt.strategy';

/** Payload của refresh token sau khi verify */
interface RefreshTokenPayload {
  sub: string;
  email: string;
  role: string;
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * POST /api/auth/register
   * Đăng ký tài khoản mới (mặc định role SIGNED_UP_USER)
   */
  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  /**
   * POST /api/auth/login
   * Đăng nhập, nhận access_token và refresh_token
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  /**
   * POST /api/auth/refresh
   * Dùng refresh token để lấy access token mới
   * Gửi token qua header: Authorization: Bearer <refreshToken>
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Headers('authorization') authHeader: string) {
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedException('Refresh token không được cung cấp');
    }

    const refreshToken = authHeader.split(' ')[1];

    try {
      const payload = this.jwtService.verify<RefreshTokenPayload>(
        refreshToken,
        { secret: this.configService.get<string>('JWT_REFRESH_SECRET') },
      );
      return this.authService.refreshTokens(payload.sub, refreshToken);
    } catch {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }
  }

  /**
   * POST /api/auth/logout
   * Đăng xuất, xoá refresh token trong DB
   */
  @Post('logout')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser('id') userId: string) {
    return this.authService.logout(userId);
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
}
