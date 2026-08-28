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
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiExtraModels,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  getSchemaPath,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { Ownership } from '../common/decorators/ownership.decorator';
import { VisibilityResource } from '../common/decorators/visibility.decorator';
import { VisibilityGuard } from '../common/guards/visibility.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { TournamentsService } from './tournaments.service';
import {
  CreateTournamentDto,
  CreateRoundDto,
} from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { TournamentListQueryDto } from './dto/tournament-list-query.dto';
import {
  TournamentFavoriteMutationResultDto,
  TournamentFavoriteViewFieldsDto,
} from './dto/tournament-favorite.dto';

/**
 * Controller Tournament — quản lý giải đấu (UC-U04, U05, U09, U10, U18)
 */
@ApiTags('Tournaments')
@ApiExtraModels(TournamentFavoriteViewFieldsDto)
@Controller('tournaments')
export class TournamentsController {
  constructor(private tournamentsService: TournamentsService) {}

  /**
   * GET /api/tournaments
   * Danh sách giải đấu Public (UC-G01, UC-G02) — không cần đăng nhập
   */
  @UseGuards(OptionalJwtAuthGuard)
  @ApiOkResponse({
    description:
      'Public Tournament page; every item includes derived favoriteCount and viewer-specific isFavorited.',
    schema: {
      type: 'object',
      properties: {
        data: {
          type: 'array',
          items: { $ref: getSchemaPath(TournamentFavoriteViewFieldsDto) },
        },
      },
      additionalProperties: true,
    },
  })
  @Get()
  findAll(
    @Query()
    query: TournamentListQueryDto,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.tournamentsService.findAllPublic(
      {
        ...query,
        search: query.q ?? query.search,
      },
      user?.id,
    );
  }

  /**
   * GET /api/tournaments/slug/:slug
   * Chi tiết giải đấu theo slug (UC-G03, UC-G04) — không cần đăng nhập
   */
  @UseGuards(OptionalJwtAuthGuard, VisibilityGuard)
  @VisibilityResource('slug:slug')
  @ApiOkResponse({
    description:
      'Tournament detail including derived favoriteCount and viewer-specific isFavorited.',
    type: TournamentFavoriteViewFieldsDto,
  })
  @Get('slug/:slug')
  findByLegacySlug(
    @Param('slug') slug: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.tournamentsService.findBySlug(slug, user?.id, user?.role);
  }

  @UseGuards(JwtAuthGuard, VisibilityGuard)
  @VisibilityResource('slug:slug')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Favorite and follow important Tournament-wide updates',
  })
  @ApiOkResponse({ type: TournamentFavoriteMutationResultDto })
  @HttpCode(HttpStatus.OK)
  @Post(':slug/favorite')
  favorite(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tournamentsService.favorite(user.id, slug);
  }

  @UseGuards(JwtAuthGuard, VisibilityGuard)
  @VisibilityResource('slug:slug')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Remove a Favorite and stop future follower notifications',
  })
  @ApiOkResponse({ type: TournamentFavoriteMutationResultDto })
  @Delete(':slug/favorite')
  unfavorite(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    return this.tournamentsService.unfavorite(user.id, slug);
  }

  @UseGuards(OptionalJwtAuthGuard, VisibilityGuard)
  @VisibilityResource('slug:slug')
  @Get(':slug/standings')
  standings(
    @Param('slug') slug: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.tournamentsService.getStandings(slug, user?.id, user?.role);
  }

  @UseGuards(OptionalJwtAuthGuard, VisibilityGuard)
  @VisibilityResource('slug:slug')
  @Get(':slug/schedule')
  schedule(@Param('slug') slug: string) {
    return this.tournamentsService.getSchedule(slug);
  }

  @UseGuards(OptionalJwtAuthGuard, VisibilityGuard)
  @VisibilityResource('slug:slug')
  @Get(':slug/bracket')
  bracket(@Param('slug') slug: string) {
    return this.tournamentsService.getBracket(slug);
  }

  @UseGuards(OptionalJwtAuthGuard, VisibilityGuard)
  @VisibilityResource('slug:slug')
  @ApiOkResponse({
    description:
      'Tournament detail including derived favoriteCount and viewer-specific isFavorited.',
    type: TournamentFavoriteViewFieldsDto,
  })
  @Get(':slug')
  findBySlug(
    @Param('slug') slug: string,
    @CurrentUser() user?: AuthenticatedUser,
  ) {
    return this.tournamentsService.findBySlug(slug, user?.id, user?.role);
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
