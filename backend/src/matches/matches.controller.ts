import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { Ownership } from '../common/decorators/ownership.decorator';
import { VisibilityResource } from '../common/decorators/visibility.decorator';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { VisibilityGuard } from '../common/guards/visibility.guard';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import {
  BulkScheduleDto,
  CreateManualMatchDto,
  PutMatchScoresDto,
  UpdateMatchDto,
} from './dto/match.dto';
import { MatchesService } from './matches.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { AllowAdminOverride } from '../common/decorators/allow-admin-override.decorator';
import { MyMatchesQueryDto } from './dto/my-matches-query.dto';
import { MyMatchesResponseDto } from './dto/my-matches-response.dto';

@ApiTags('Matches')
@Controller()
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @ApiBearerAuth()
  @ApiOperation({ summary: 'List matches for the current user teams' })
  @ApiOkResponse({ type: MyMatchesResponseDto })
  @UseGuards(JwtAuthGuard)
  @Get('users/me/matches')
  findMine(
    @CurrentUser('id') userId: string,
    @Query() query: MyMatchesQueryDto,
  ) {
    return this.matches.findForUser(userId, query);
  }

  @UseGuards(OptionalJwtAuthGuard, VisibilityGuard)
  @VisibilityResource('match:id')
  @Get('matches/:id')
  findOne(@Param('id') id: string) {
    return this.matches.findOne(id);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('matches:body')
  @AllowAdminOverride()
  @Patch('matches/bulk-schedule')
  bulkSchedule(@Body() dto: BulkScheduleDto) {
    return this.matches.bulkSchedule(dto);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('match:id')
  @AllowAdminOverride()
  @Patch('matches/:id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateMatchDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.matches.update(id, dto, actorId);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('match:id')
  @AllowAdminOverride()
  @Put('matches/:id/scores')
  putScores(
    @Param('id') id: string,
    @Body() dto: PutMatchScoresDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.matches.putScores(id, dto, actorId);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('round:id')
  @AllowAdminOverride()
  @Post('rounds/:id/matches')
  createManual(@Param('id') id: string, @Body() dto: CreateManualMatchDto) {
    return this.matches.createManual(id, dto);
  }
}
