import {
  Controller,
  Get,
  Patch,
  Param,
  Query,
  ParseIntPipe,
  DefaultValuePipe,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  /**
   * GET /api/admin/users
   * Danh sách người dùng (phân trang) — admin
   */
  @Get('users')
  listUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
  ) {
    // Giới hạn limit hợp lệ
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    return this.adminService.listUsers(safePage, safeLimit);
  }

  /**
   * PATCH /api/admin/users/:id/lock
   * Khóa / mở khóa tài khoản người dùng — admin
   * Body: { "isLocked": true }
   */
  @Patch('users/:id/lock')
  @HttpCode(HttpStatus.OK)
  async setLock(
    @Param('id') userId: string,
    @CurrentUser('id') adminId: string,
    @Query('isLocked') isLockedRaw?: string,
  ) {
    // Admin không thể khóa chính mình
    if (userId === adminId) {
      throw new BadRequestException('Không thể khóa tài khoản của chính mình');
    }

    // Không dùng ParseBoolPipe: global ValidationPipe (transform) đã ép chuỗi lạ
    // thành false trước khi pipe chạy, khiến ?isLocked=1 âm thầm mở khóa
    if (isLockedRaw !== undefined && !['true', 'false'].includes(isLockedRaw)) {
      throw new BadRequestException(
        'isLocked chỉ nhận giá trị true hoặc false',
      );
    }

    return this.adminService.setUserLockStatus(userId, isLockedRaw !== 'false');
  }
}
