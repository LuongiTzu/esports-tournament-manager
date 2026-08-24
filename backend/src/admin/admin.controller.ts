import {
  Controller,
  Get,
  Post,
  Delete,
  Body,
  Patch,
  Param,
  Query,
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
import {
  AdminCommentListQueryDto,
  AdminReportListQueryDto,
  AdminTournamentListQueryDto,
  AdminUsersQueryDto,
} from './dto/admin-query.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('tournaments')
  listTournaments(@Query() query: AdminTournamentListQueryDto) {
    return this.adminService.listTournaments(query.moderationStatus);
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
  listReports(@Query() query: AdminReportListQueryDto) {
    return this.adminService.listReports(query.status);
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
  listComments(@Query() query: AdminCommentListQueryDto) {
    return this.adminService.listComments(query);
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
  listUsers(@Query() query: AdminUsersQueryDto) {
    const safeLimit = Math.min(query.limit ?? 20, 100);
    const safePage = query.page ?? 1;
    return this.adminService.listUsers(safePage, safeLimit, {
      search: query.search,
      isLocked: query.isLocked,
      role: query.role,
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
