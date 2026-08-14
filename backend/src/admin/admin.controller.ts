import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
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
import { ModerationStatus, ReportStatus, Role } from '@prisma/client';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import {
  CreateBannedKeywordDto,
  UpdateBannedKeywordDto,
} from './dto/banned-keyword.dto';
import {
  LockUserDto,
  ModerateTournamentDto,
  ReviewReportDto,
  VerifyTournamentDto,
} from './dto/moderation.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('tournaments')
  listTournaments(@Query('moderationStatus') status?: ModerationStatus) {
    if (status && !Object.values(ModerationStatus).includes(status)) {
      throw new BadRequestException('Invalid moderationStatus');
    }
    return this.adminService.listTournaments(status);
  }

  @Patch('tournaments/:id/moderation')
  moderateTournament(
    @Param('id') id: string,
    @Body() dto: ModerateTournamentDto,
  ) {
    return this.adminService.moderateTournament(
      id,
      dto.moderationStatus,
      dto.reason,
    );
  }

  @Get('reports')
  listReports(@Query('status') status?: ReportStatus) {
    if (status && !Object.values(ReportStatus).includes(status)) {
      throw new BadRequestException('Invalid report status');
    }
    return this.adminService.listReports(status);
  }

  @Patch('reports/:id')
  reviewReport(
    @Param('id') id: string,
    @Body() dto: ReviewReportDto,
    @CurrentUser('id') adminId: string,
  ) {
    return this.adminService.reviewReport(id, dto.status, adminId);
  }

  @Get('comments')
  listComments(
    @Query('isHidden') isHiddenRaw?: string,
    @Query('search') search?: string,
  ) {
    if (isHiddenRaw && !['true', 'false'].includes(isHiddenRaw)) {
      throw new BadRequestException('isHidden must be true or false');
    }
    return this.adminService.listComments({
      isHidden: isHiddenRaw === undefined ? undefined : isHiddenRaw === 'true',
      search,
    });
  }

  @Patch('comments/:id/hide')
  hideComment(@Param('id') id: string) {
    return this.adminService.hideComment(id);
  }

  @Patch('comments/:id/unhide')
  unhideComment(@Param('id') id: string) {
    return this.adminService.unhideComment(id);
  }

  @Delete('comments/:id')
  deleteComment(@Param('id') id: string) {
    return this.adminService.deleteComment(id);
  }

  @Get('stats')
  stats() {
    return this.adminService.stats();
  }

  @Patch('tournaments/:id/verify')
  verifyTournament(@Param('id') id: string, @Body() dto: VerifyTournamentDto) {
    return this.adminService.verifyTournament(id, dto.isVerified);
  }

  @Get('banned-keywords')
  listBannedKeywords() {
    return this.adminService.listBannedKeywords();
  }

  @Post('banned-keywords')
  createBannedKeyword(@Body() dto: CreateBannedKeywordDto) {
    return this.adminService.createBannedKeyword(dto);
  }

  @Patch('banned-keywords/:id')
  updateBannedKeyword(
    @Param('id') id: string,
    @Body() dto: UpdateBannedKeywordDto,
  ) {
    return this.adminService.updateBannedKeyword(id, dto);
  }

  @Delete('banned-keywords/:id')
  deleteBannedKeyword(@Param('id') id: string) {
    return this.adminService.deleteBannedKeyword(id);
  }

  /**
   * GET /api/admin/users
   * Danh sách người dùng (phân trang) — admin
   */
  @Get('users')
  listUsers(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('isLocked') isLockedRaw?: string,
    @Query('role') role?: Role,
  ) {
    if (isLockedRaw && !['true', 'false'].includes(isLockedRaw)) {
      throw new BadRequestException('isLocked must be true or false');
    }
    if (role && !Object.values(Role).includes(role)) {
      throw new BadRequestException('Invalid role');
    }
    // Giới hạn limit hợp lệ
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(page, 1);
    return this.adminService.listUsers(safePage, safeLimit, {
      search,
      isLocked: isLockedRaw === undefined ? undefined : isLockedRaw === 'true',
      role,
    });
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
    @Body() dto: LockUserDto,
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

    return this.adminService.setUserLockStatus(
      userId,
      dto.isLocked ?? isLockedRaw !== 'false',
    );
  }
}
