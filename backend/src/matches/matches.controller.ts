import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
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
import {
  MatchCheckInDto,
  MatchCheckInResponseDto,
} from './dto/match-check-in.dto';
import {
  MatchResultReviewDto,
  ResolveMatchDisputeDto,
  RespondToMatchResultDto,
} from './dto/match-result-review.dto';
import { TournamentStaffRole } from '@prisma/client';
import { TournamentStaffRoles } from '../common/decorators/tournament-staff-roles.decorator';

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

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Check the current user team in for a match' })
  @ApiOkResponse({ type: MatchCheckInResponseDto })
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @HttpCode(HttpStatus.OK)
  @Post('matches/:id/check-ins')
  checkIn(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: MatchCheckInDto,
  ) {
    return this.matches.checkIn(id, userId, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Confirm or dispute a completed match result' })
  @ApiOkResponse({ type: MatchResultReviewDto })
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard)
  @HttpCode(HttpStatus.OK)
  @Post('matches/:id/result-review/responses')
  respondToResult(
    @Param('id') id: string,
    @CurrentUser('id') userId: string,
    @Body() dto: RespondToMatchResultDto,
  ) {
    return this.matches.respondToResult(id, userId, dto);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get a match result review for its organizer' })
  @ApiOkResponse({ type: MatchResultReviewDto })
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('match:id')
  @TournamentStaffRoles(
    TournamentStaffRole.CO_ORGANIZER,
    TournamentStaffRole.REFEREE,
    TournamentStaffRole.SCOREKEEPER,
  )
  @AllowAdminOverride()
  @Get('matches/:id/result-review')
  findResultReview(@Param('id') id: string) {
    return this.matches.findResultReview(id);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resolve a disputed match result' })
  @ApiOkResponse({ type: MatchResultReviewDto })
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('match:id')
  @TournamentStaffRoles(
    TournamentStaffRole.CO_ORGANIZER,
    TournamentStaffRole.REFEREE,
  )
  @AllowAdminOverride()
  @Patch('matches/:id/result-review/resolve')
  resolveResultDispute(
    @Param('id') id: string,
    @CurrentUser('id') actorId: string,
    @Body() dto: ResolveMatchDisputeDto,
  ) {
    return this.matches.resolveResultDispute(id, actorId, dto);
  }

  @UseGuards(OptionalJwtAuthGuard, VisibilityGuard)
  @VisibilityResource('match:id')
  @Get('matches/:id')
  findOne(@Param('id') id: string) {
    return this.matches.findOne(id);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('matches:body')
  @TournamentStaffRoles(
    TournamentStaffRole.CO_ORGANIZER,
    TournamentStaffRole.REFEREE,
  )
  @AllowAdminOverride()
  @Patch('matches/bulk-schedule')
  bulkSchedule(@Body() dto: BulkScheduleDto) {
    return this.matches.bulkSchedule(dto);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('match:id')
  @TournamentStaffRoles(
    TournamentStaffRole.CO_ORGANIZER,
    TournamentStaffRole.REFEREE,
    TournamentStaffRole.SCOREKEEPER,
  )
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
  @TournamentStaffRoles(
    TournamentStaffRole.CO_ORGANIZER,
    TournamentStaffRole.REFEREE,
    TournamentStaffRole.SCOREKEEPER,
  )
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
  @TournamentStaffRoles(
    TournamentStaffRole.CO_ORGANIZER,
    TournamentStaffRole.REFEREE,
  )
  @AllowAdminOverride()
  @Post('rounds/:id/matches')
  createManual(@Param('id') id: string, @Body() dto: CreateManualMatchDto) {
    return this.matches.createManual(id, dto);
  }
}
