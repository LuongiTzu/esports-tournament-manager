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
import { Role } from '@prisma/client';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { VisibilityResource } from '../common/decorators/visibility.decorator';
import { VisibilityGuard } from '../common/guards/visibility.guard';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  AdminRatingQueryDto,
  ModerateRatingDto,
  SaveRatingDto,
} from './rating.dto';
import { RatingService } from './rating.service';

@Controller('tournaments/:slug/ratings')
@VisibilityResource('slug:slug')
export class RatingController {
  constructor(private readonly ratings: RatingService) {}

  @Get()
  @UseGuards(OptionalJwtAuthGuard, VisibilityGuard)
  list(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser | undefined,
    @Query() query: PaginationQueryDto,
  ) {
    return this.ratings.list(slug, user, query);
  }
  @Post()
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, VisibilityGuard)
  create(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveRatingDto,
  ) {
    return this.ratings.save(slug, user, dto, true);
  }
  @Patch('me')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, VisibilityGuard)
  update(
    @Param('slug') slug: string,
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SaveRatingDto,
  ) {
    return this.ratings.save(slug, user, dto, false);
  }
  @Delete('me')
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, VisibilityGuard)
  remove(@Param('slug') slug: string, @CurrentUser('id') id: string) {
    return this.ratings.remove(slug, id);
  }
}

@Controller('admin/ratings')
@UseGuards(JwtAuthGuard, EmailVerifiedGuard, RolesGuard)
@Roles(Role.ADMIN)
export class AdminRatingController {
  constructor(private readonly ratings: RatingService) {}
  @Get()
  list(@Query() query: AdminRatingQueryDto) {
    return this.ratings.adminList(query);
  }
  @Patch(':id/moderation')
  moderate(
    @Param('id') id: string,
    @CurrentUser('id') adminId: string,
    @Body() dto: ModerateRatingDto,
  ) {
    return this.ratings.moderate(id, adminId, dto);
  }
}
