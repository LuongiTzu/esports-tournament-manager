import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { CookieOptions, Request, Response } from 'express';

const REFRESH_COOKIE_NAME = 'etm_refresh';
const REFRESH_COOKIE_PATH = '/api/auth';
const DEFAULT_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class RefreshCookieService {
  constructor(private readonly config: ConfigService) {}

  read(request: Request): string {
    this.assertTrustedOrigin(request);
    const cookieHeader = request.headers.cookie;
    const refreshToken = cookieHeader
      ?.split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${REFRESH_COOKIE_NAME}=`))
      ?.slice(REFRESH_COOKIE_NAME.length + 1);

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token không được cung cấp');
    }

    try {
      return decodeURIComponent(refreshToken);
    } catch {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }
  }

  set(response: Response, refreshToken: string): void {
    response.cookie(REFRESH_COOKIE_NAME, refreshToken, this.options());
  }

  clear(response: Response): void {
    const { maxAge: _maxAge, ...options } = this.options();
    response.clearCookie(REFRESH_COOKIE_NAME, options);
  }

  assertTrustedOrigin(request: Request): void {
    const origin = request.headers.origin;
    if (!origin) return;

    const allowedOrigins = this.config
      .get<string>('FRONTEND_URL', 'http://localhost:3000')
      .split(',')
      .map((value) => value.trim().replace(/\/$/, ''))
      .filter(Boolean);

    if (!allowedOrigins.includes(origin.replace(/\/$/, ''))) {
      throw new ForbiddenException('Nguồn yêu cầu không được phép');
    }
  }

  private options(): CookieOptions {
    const secure = this.cookieSecure();
    const sameSite = this.cookieSameSite();
    if (sameSite === 'none' && !secure) {
      throw new Error(
        'AUTH_COOKIE_SAME_SITE=none requires AUTH_COOKIE_SECURE=true',
      );
    }

    return {
      httpOnly: true,
      secure,
      sameSite,
      path: REFRESH_COOKIE_PATH,
      maxAge: this.cookieMaxAge(),
    };
  }

  private cookieSecure(): boolean {
    const configured = this.config.get<string>('AUTH_COOKIE_SECURE');
    if (configured !== undefined) return configured === 'true';
    return this.config.get<string>('NODE_ENV') === 'production';
  }

  private cookieSameSite(): 'lax' | 'strict' | 'none' {
    const configured = this.config
      .get<string>('AUTH_COOKIE_SAME_SITE', 'lax')
      .toLowerCase();
    if (configured === 'strict' || configured === 'none') return configured;
    return 'lax';
  }

  private cookieMaxAge(): number {
    const configured = Number(
      this.config.get<string>(
        'REFRESH_COOKIE_MAX_AGE_MS',
        String(DEFAULT_MAX_AGE_MS),
      ),
    );
    return Number.isFinite(configured) && configured > 0
      ? configured
      : DEFAULT_MAX_AGE_MS;
  }
}
