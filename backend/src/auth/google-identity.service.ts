import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

const DEFAULT_GOOGLE_CLIENT_ID =
  '949601885792-m52054b0aansuoaoe8b208qgl9a4t8hr.apps.googleusercontent.com';

export interface GoogleIdentity {
  subject: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  canSafelyLinkByEmail: boolean;
}

@Injectable()
export class GoogleIdentityService {
  private readonly client = new OAuth2Client();

  constructor(private readonly config: ConfigService) {}

  async verifyCredential(credential: string): Promise<GoogleIdentity> {
    try {
      const clientId =
        this.config.get<string>('GOOGLE_CLIENT_ID') ?? DEFAULT_GOOGLE_CLIENT_ID;
      const ticket = await this.client.verifyIdToken({
        idToken: credential,
        audience: clientId,
      });
      const payload = ticket.getPayload();

      if (!payload?.sub || !payload.email || payload.email_verified !== true) {
        throw new UnauthorizedException('Tài khoản Google chưa xác minh email');
      }

      const email = payload.email.toLowerCase();
      return {
        subject: payload.sub,
        email,
        displayName: payload.name?.trim() || email.split('@')[0],
        avatarUrl: payload.picture,
        canSafelyLinkByEmail:
          email.endsWith('@gmail.com') || typeof payload.hd === 'string',
      };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException(
        'Thông tin đăng nhập Google không hợp lệ hoặc đã hết hạn',
      );
    }
  }
}
