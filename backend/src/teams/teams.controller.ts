import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { Ownership } from '../common/decorators/ownership.decorator';
import { VisibilityResource } from '../common/decorators/visibility.decorator';
import { VisibilityGuard } from '../common/guards/visibility.guard';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { TeamsService } from './teams.service';
import { TeamAccess, TeamAccessGuard } from './guards/team-access.guard';
import { RegisterTeamDto, TeamMemberInputDto } from './dto/register-team.dto';
import {
  UpdateTeamDto,
  UpdateTeamMemberDto,
  UpdateTeamStatusDto,
} from './dto/update-team.dto';

/**
 * Controller Team — đăng ký & quản lý hồ sơ đội (UC-U06, U07, U08, U11, U12, G06)
 */
@Controller()
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  /**
   * GET /api/tournaments/:slug/registration-form
   * Cấu hình + prefill form đăng ký (GĐ 4.1) — cần đăng nhập
   */
  @UseGuards(JwtAuthGuard)
  @Get('tournaments/:slug/registration-form')
  getRegistrationForm(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
  ) {
    return this.teamsService.getRegistrationForm(slug, user);
  }

  /**
   * POST /api/tournaments/:slug/register
   * Đăng ký đội tham gia giải (UC-U11) — cần đăng nhập
   */
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @Post('tournaments/:slug/register')
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
    @Body() dto: RegisterTeamDto,
  ) {
    return this.teamsService.register(user.id, slug, dto);
  }

  /**
   * GET /api/tournaments/:slug/teams
   * Danh sách đội của 1 giải (UC-G05) — khách chỉ thấy đội đã duyệt
   */
  @UseGuards(OptionalJwtAuthGuard, VisibilityGuard)
  @VisibilityResource('slug:slug')
  @Get('tournaments/:slug/teams')
  findByTournament(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('slug') slug: string,
    @Query('status') status?: string,
  ) {
    return this.teamsService.findByTournament(slug, user?.id, status);
  }

  /**
   * POST /api/tournaments/:slug/teams
   * BTC thêm đội thủ công (UC-U06) — chỉ BTC, đội vào thẳng APPROVED
   */
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('slug:slug')
  @Post('tournaments/:slug/teams')
  addManual(
    @CurrentUser() user: AuthenticatedUser,
    @Param('slug') slug: string,
    @Body() dto: RegisterTeamDto,
  ) {
    return this.teamsService.addManual(user.id, slug, dto);
  }

  /**
   * GET /api/users/me/teams
   * Danh sách đội của tôi kèm trạng thái từng giải (UC-U12)
   */
  @UseGuards(JwtAuthGuard)
  @Get('users/me/teams')
  findMyTeams(@CurrentUser('id') userId: string) {
    return this.teamsService.findMyTeams(userId);
  }

  /**
   * GET /api/teams/:id
   * Chi tiết đội kèm roster (UC-G06) — thông tin liên hệ chỉ hiện với BTC/đội
   */
  @UseGuards(OptionalJwtAuthGuard, VisibilityGuard)
  @VisibilityResource('team:id')
  @Get('teams/:id')
  findOne(
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Param('id') id: string,
  ) {
    return this.teamsService.findOne(id, user?.id);
  }

  /**
   * PATCH /api/teams/:id
   * Sửa hồ sơ đội (UC-U12) — đội trưởng hoặc BTC
   */
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, TeamAccessGuard)
  @TeamAccess('CAPTAIN_OR_ORGANIZER')
  @Patch('teams/:id')
  update(@Param('id') id: string, @Body() dto: UpdateTeamDto) {
    return this.teamsService.update(id, dto);
  }

  /**
   * POST /api/teams/:id/members
   * Thêm thành viên vào roster — chạy lại validator trên toàn đội
   */
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, TeamAccessGuard)
  @TeamAccess('CAPTAIN_OR_ORGANIZER')
  @Post('teams/:id/members')
  addMember(@Param('id') id: string, @Body() dto: TeamMemberInputDto) {
    return this.teamsService.addMember(id, dto);
  }

  /**
   * PATCH /api/teams/:id/members/:memberId
   * Sửa thông tin 1 thành viên — chạy lại validator trên toàn đội
   */
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, TeamAccessGuard)
  @TeamAccess('CAPTAIN_OR_ORGANIZER')
  @Patch('teams/:id/members/:memberId')
  updateMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string,
    @Body() dto: UpdateTeamMemberDto,
  ) {
    return this.teamsService.updateMember(id, memberId, dto);
  }

  /**
   * DELETE /api/teams/:id/members/:memberId
   * Xóa thành viên khỏi roster — chạy lại validator trên toàn đội
   */
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, TeamAccessGuard)
  @TeamAccess('CAPTAIN_OR_ORGANIZER')
  @Delete('teams/:id/members/:memberId')
  removeMember(@Param('id') id: string, @Param('memberId') memberId: string) {
    return this.teamsService.removeMember(id, memberId);
  }

  /**
   * PATCH /api/teams/:id/status
   * BTC duyệt / từ chối đội (UC-U08)
   */
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, TeamAccessGuard)
  @TeamAccess('ORGANIZER')
  @Patch('teams/:id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateTeamStatusDto) {
    return this.teamsService.updateStatus(id, dto);
  }

  /**
   * DELETE /api/teams/:id
   * Đội trưởng tự rút đăng ký (chỉ khi PENDING) hoặc BTC xóa đội
   */
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, TeamAccessGuard)
  @TeamAccess('CAPTAIN_OR_ORGANIZER')
  @Delete('teams/:id')
  remove(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.teamsService.remove(id, userId);
  }
}
