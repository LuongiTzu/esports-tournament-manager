import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { SignOptions } from 'jsonwebtoken';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  // ─── Đăng ký ────────────────────────────────────────────────────
  async register(dto: RegisterDto) {
    // Kiểm tra email đã tồn tại chưa
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email này đã được sử dụng');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Tạo user mới (birthDate: string → Date)
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash: hashedPassword,
        displayName: dto.displayName,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        currentAddress: dto.currentAddress,
        phoneNumber: dto.phoneNumber,
        gender: dto.gender,
        bio: dto.bio,
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
        createdAt: true,
      },
    });

    return {
      message: 'Đăng ký thành công',
      user,
    };
  }

  // ─── Đăng nhập ──────────────────────────────────────────────────
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    // Kiểm tra tài khoản có bị khóa không
    if (user.isLocked) {
      throw new UnauthorizedException(
        'Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin để biết thêm chi tiết',
      );
    }

    const isPasswordValid = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.tokenVersion,
    );

    // Lưu hash refresh token vào DB
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken },
    });

    return {
      message: 'Đăng nhập thành công',
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
      },
      ...tokens,
    };
  }

  // ─── Refresh token ───────────────────────────────────────────────
  async refreshTokens(userId: string, refreshToken: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.refreshToken) {
      throw new UnauthorizedException('Phiên đăng nhập không hợp lệ');
    }

    const isRefreshTokenValid = await bcrypt.compare(
      refreshToken,
      user.refreshToken,
    );

    if (!isRefreshTokenValid) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }

    const tokens = await this.generateTokens(
      user.id,
      user.email,
      user.role,
      user.tokenVersion,
    );

    // Cập nhật refresh token mới
    const hashedRefreshToken = await bcrypt.hash(tokens.refreshToken, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: hashedRefreshToken },
    });

    return tokens;
  }

  // ─── Đăng xuất ──────────────────────────────────────────────────
  async logout(userId: string) {
    // Tăng tokenVersion để vô hiệu toàn bộ access token đang lưu hành
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        refreshToken: null,
        tokenVersion: { increment: 1 },
      },
    });
    return { message: 'Đăng xuất thành công' };
  }

  // ─── Đổi mật khẩu (khi đã đăng nhập) ───────────────────────────
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('Tài khoản không tồn tại');
    }

    // Kiểm tra mật khẩu hiện tại
    const isCurrentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );
    if (!isCurrentPasswordValid) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }

    // Tránh đặt trùng mật khẩu cũ
    const isSamePassword = await bcrypt.compare(
      dto.newPassword,
      user.passwordHash,
    );
    if (isSamePassword) {
      throw new BadRequestException(
        'Mật khẩu mới không được trùng với mật khẩu hiện tại',
      );
    }

    // Hash mật khẩu mới + tăng tokenVersion để vô hiệu token cũ
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        passwordHash: hashedPassword,
        refreshToken: null,
        tokenVersion: { increment: 1 },
      },
    });

    return { message: 'Đổi mật khẩu thành công. Vui lòng đăng nhập lại' };
  }

  // ─── Quên mật khẩu (gửi email) ─────────────────────────────────
  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    // Trả về message chung để không lộ email đã đăng ký
    if (!user) {
      return {
        message:
          'Nếu email tồn tại, bạn sẽ nhận được liên kết đặt lại mật khẩu',
      };
    }

    // Tạo reset token JWT (hạn 15 phút)
    const resetToken = await this.jwtService.signAsync(
      { sub: user.id, email: user.email },
      {
        secret: this.configService.getOrThrow<string>('JWT_RESET_SECRET'),
        expiresIn: '15m',
      },
    );

    // Lưu hash token + hạn sử dụng vào DB
    const hashedResetToken = await bcrypt.hash(resetToken, 10);
    const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 phút
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetPasswordToken: hashedResetToken,
        resetPasswordExpires: resetExpires,
      },
    });

    // TODO: Tích hợp SMTP/email service để gửi link thực tế.
    // Hiện tại trả token trực tiếp trong response để tiện test (dev mode).
    return {
      message: 'Yêu cầu đặt lại mật khẩu đã được xử lý',
      resetToken,
      expiresIn: '15m',
    };
  }

  // ─── Đặt lại mật khẩu (dùng token từ email) ────────────────────
  async resetPassword(dto: ResetPasswordDto) {
    let payload: { sub: string };

    try {
      payload = await this.jwtService.verifyAsync<{ sub: string }>(dto.token, {
        secret: this.configService.getOrThrow<string>('JWT_RESET_SECRET'),
      });
    } catch {
      throw new BadRequestException(
        'Token đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
    });

    if (!user) {
      throw new BadRequestException('Tài khoản không tồn tại');
    }

    // Kiểm tra token hash có khớp và chưa hết hạn
    if (!user.resetPasswordToken) {
      throw new BadRequestException(
        'Yêu cầu đặt lại mật khẩu chưa được khởi tạo',
      );
    }

    const isTokenValid = await bcrypt.compare(
      dto.token,
      user.resetPasswordToken,
    );
    if (!isTokenValid) {
      throw new BadRequestException('Token đặt lại mật khẩu không hợp lệ');
    }

    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      throw new BadRequestException('Token đặt lại mật khẩu đã hết hạn');
    }

    // Hash mật khẩu mới + xóa token + tăng tokenVersion (vô hiệu token cũ)
    const hashedPassword = await bcrypt.hash(dto.newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: hashedPassword,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        refreshToken: null,
        tokenVersion: { increment: 1 },
      },
    });

    return { message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập lại' };
  }

  // ─── Helper: sinh access + refresh token ────────────────────────
  private async generateTokens(
    userId: string,
    email: string,
    role: string,
    tokenVersion: number,
  ) {
    const payload = { sub: userId, email, role, tokenVersion };

    const accessTokenExpiresIn = (this.configService.get<string>(
      'JWT_EXPIRES_IN',
      '15m',
    ) ?? '15m') as SignOptions['expiresIn'];
    const refreshTokenExpiresIn = (this.configService.get<string>(
      'JWT_REFRESH_EXPIRES_IN',
      '7d',
    ) ?? '7d') as SignOptions['expiresIn'];

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_SECRET'),
        expiresIn: accessTokenExpiresIn,
      }),
      this.jwtService.signAsync(payload, {
        secret: this.configService.getOrThrow<string>('JWT_REFRESH_SECRET'),
        expiresIn: refreshTokenExpiresIn,
      }),
    ]);

    return { accessToken, refreshToken };
  }
}
