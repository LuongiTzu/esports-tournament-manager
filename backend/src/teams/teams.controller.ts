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
import { RegistrationStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { Ownership } from '../common/decorators/ownership.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { TeamsService } from './teams.service';
import { RegisterTeamDto } from './dto/register-team.dto';

/**
 * Controller Team — quản lý đội tham gia giải (UC-U06, U07, U08, U11, U12)
 */
@Controller()
export class TeamsController {
  constructor(private teamsService: TeamsService) {}

  /**
   * GET /api/tournaments/:tournamentId/teams
   * Danh sách đội của 1 giải (UC-G05, UC-U12) — không cần đăng nhập
   */
  @Get('tournaments/:tournamentId/teams')
  findByTournament(
    @Param('tournamentId') tournamentId: string,
    @Query('status') status?: string,
  ) {
    return this.teamsService.findByTournament(tournamentId, status);
  }

  /**
   * POST /api/tournaments/:tournamentId/teams
   * Đăng ký đội tham gia giải (UC-U11) — cần đăng nhập
   */
  @UseGuards(JwtAuthGuard)
  @Post('tournaments/:tournamentId/teams')
  register(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: RegisterTeamDto,
  ) {
    return this.teamsService.register(user.id, tournamentId, dto);
  }

  /**
   * POST /api/tournaments/:tournamentId/teams/manual
   * BTC thêm đội thủ công (UC-U06) — chỉ BTC
   */
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @Ownership('tournamentId')
  @Post('tournaments/:tournamentId/teams/manual')
  addManual(
    @CurrentUser() user: AuthenticatedUser,
    @Param('tournamentId') tournamentId: string,
    @Body() dto: RegisterTeamDto,
  ) {
    return this.teamsService.addManual(user.id, tournamentId, dto);
  }

  /**
   * PATCH /api/tournaments/:tournamentId/teams/:teamId/status
   * Duyệt / từ chối đội (UC-U08) — chỉ BTC
   */
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @Ownership('tournamentId')
  @Patch('tournaments/:tournamentId/teams/:teamId/status')
  updateStatus(
    @Param('tournamentId') tournamentId: string,
    @Param('teamId') teamId: string,
    @Body('status') status: RegistrationStatus,
  ) {
    return this.teamsService.updateStatus(teamId, status, tournamentId);
  }

  /**
   * DELETE /api/tournaments/:tournamentId/teams/:teamId
   * Xóa đội (UC-U06) — chỉ BTC
   */
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @Ownership('tournamentId')
  @Delete('tournaments/:tournamentId/teams/:teamId')
  remove(
    @Param('tournamentId') tournamentId: string,
    @Param('teamId') teamId: string,
  ) {
    return this.teamsService.remove(teamId, tournamentId);
  }
}
