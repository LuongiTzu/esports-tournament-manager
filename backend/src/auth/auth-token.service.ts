import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import type { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthTokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  verifyRefresh(token: string): Promise<JwtPayload> {
    return this.jwt.verifyAsync<JwtPayload>(token, {
      secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
    });
  }

  verifyReset(token: string): Promise<{ sub: string }> {
    return this.jwt.verifyAsync<{ sub: string }>(token, {
      secret: this.config.getOrThrow<string>('JWT_RESET_SECRET'),
    });
  }

  issueReset(userId: string, email: string): Promise<string> {
    return this.jwt.signAsync(
      { sub: userId, email },
      {
        secret: this.config.getOrThrow<string>('JWT_RESET_SECRET'),
        expiresIn: '15m',
      },
    );
  }

  async issuePair(
    userId: string,
    email: string,
    role: string,
    tokenVersion: number,
  ) {
    const payload = { sub: userId, email, role, tokenVersion };
    const accessTokenExpiresIn = (this.config.get<string>(
      'JWT_EXPIRES_IN',
      '15m',
    ) ?? '15m') as SignOptions['expiresIn'];
    const refreshTokenExpiresIn = (this.config.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    ) ?? '7d') as SignOptions['expiresIn'];
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_SECRET'),
        expiresIn: accessTokenExpiresIn,
      }),
      this.jwt.signAsync(payload, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTokenExpiresIn,
      }),
    ]);
    return { accessToken, refreshToken };
  }
}
