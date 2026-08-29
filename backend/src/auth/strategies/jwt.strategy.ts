import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';

export interface JwtPayload {
  sub: string; // userId
  email: string;
  role: string;
  tokenVersion: number; // phiên bản token - tăng khi logout/đổi mật khẩu
}

/** User đã xác thực được gắn vào request sau khi qua JwtAuthGuard */
export interface AuthenticatedUser {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  birthDate: Date | null;
  currentAddress: string | null;
  phoneNumber: string | null;
  gender: string | null;
  bio: string | null;
  role: string;
  emailVerifiedAt: Date | null;
  isLocked: boolean;
  tokenVersion: number;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private configService: ConfigService,
    private prisma: PrismaService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
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
        isLocked: true,
        tokenVersion: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }

    // Kiểm tra tài khoản có bị khóa không
    if (user.isLocked) {
      throw new UnauthorizedException(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin để biết thêm chi tiết',
      );
    }

    // Kiểm tra tokenVersion - token cũ (trước logout/đổi mật khẩu) sẽ không hợp lệ
    if (payload.tokenVersion !== user.tokenVersion) {
      throw new UnauthorizedException(
        'Phiên đăng nhập đã hết hiệu lực. Vui lòng đăng nhập lại',
      );
    }

    return user; // gắn vào req.user
  }
}
