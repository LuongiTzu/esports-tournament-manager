import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  /** Lấy hồ sơ người dùng hiện tại */
  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
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
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('Không tìm thấy người dùng');
    }

    return user;
  }

  /** Cập nhật hồ sơ người dùng hiện tại */
  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Kiểm tra user tồn tại
    await this.getProfile(userId);

    // Chỉ đưa vào data những field được gửi lên (tránh ghi đè null không mong muốn)
    const data: Prisma.UserUpdateInput = {};

    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName;
    }
    if (dto.avatarUrl !== undefined) {
      data.avatarUrl = dto.avatarUrl || null;
    }
    if (dto.birthDate !== undefined) {
      data.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    }
    if (dto.currentAddress !== undefined) {
      data.currentAddress = dto.currentAddress || null;
    }
    if (dto.phoneNumber !== undefined) {
      data.phoneNumber = dto.phoneNumber || null;
    }
    if (dto.gender !== undefined) {
      data.gender = dto.gender;
    }
    if (dto.bio !== undefined) {
      data.bio = dto.bio || null;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
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
        updatedAt: true,
      },
    });

    return user;
  }
}
