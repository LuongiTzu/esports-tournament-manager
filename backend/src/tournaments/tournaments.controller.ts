import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { TournamentStatus, TournamentMode } from '@prisma/client';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { Ownership } from '../common/decorators/ownership.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { TournamentsService } from './tournaments.service';
import {
  CreateTournamentDto,
  CreateRoundDto,
} from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';

/**
 * Controller Tournament — quản lý giải đấu (UC-U04, U05, U09, U10, U18)
 */
@Controller('tournaments')
export class TournamentsController {
  constructor(private tournamentsService: TournamentsService) {}

  /**
   * GET /api/tournaments
   * Danh sách giải đấu Public (UC-G01, UC-G02) — không cần đăng nhập
   */
  @Get()
  findAll(
    @Query()
    query: {
      search?: string;
      gameId?: string;
      status?: TournamentStatus;
      mode?: TournamentMode;
      isVerified?: string;
      page?: number;
      limit?: number;
    },
  ) {
    return this.tournamentsService.findAllPublic(query);
  }

  /**
   * GET /api/tournaments/slug/:slug
   * Chi tiết giải đấu theo slug (UC-G03, UC-G04) — không cần đăng nhập
   */
  @Get('slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.tournamentsService.findBySlug(slug);
  }

  @UseGuards(OptionalJwtAuthGuard)
  @Get(':slug/standings')
  standings(
    @Param('slug') slug: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.tournamentsService.getStandings(slug, user?.id);
  }

  /**
   * POST /api/tournaments
   * Tạo giải đấu mới (UC-U04) — cần đăng nhập
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTournamentDto,
  ) {
    return this.tournamentsService.create(user.id, dto);
  }

  /**
   * PATCH /api/tournaments/:tournamentId
   * Cập nhật giải đấu (UC-U09) — chỉ BTC
   */
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @Ownership('tournamentId')
  @Patch(':tournamentId')
  update(
    @Param('tournamentId') tournamentId: string,
    @Body() dto: UpdateTournamentDto,
  ) {
    return this.tournamentsService.update(tournamentId, dto);
  }

  /**
   * DELETE /api/tournaments/:tournamentId
   * Xóa giải đấu (UC-U10) — chỉ BTC
   */
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @Ownership('tournamentId')
  @Delete(':tournamentId')
  remove(@Param('tournamentId') tournamentId: string) {
    return this.tournamentsService.remove(tournamentId);
  }

  /**
   * POST /api/tournaments/:tournamentId/rounds
   * Thêm Round vào giải (UC-U05) — chỉ BTC
   */
  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @Ownership('slug:slug')
  @Post(':slug/rounds')
  addRound(@Param('slug') slug: string, @Body() dto: CreateRoundDto) {
    return this.tournamentsService.addRoundBySlug(slug, dto);
  }
}
