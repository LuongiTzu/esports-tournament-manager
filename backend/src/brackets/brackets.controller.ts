import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseBoolPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { Ownership } from '../common/decorators/ownership.decorator';
import { VisibilityResource } from '../common/decorators/visibility.decorator';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { VisibilityGuard } from '../common/guards/visibility.guard';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import { BracketOperationsService } from './bracket-operations.service';
import {
  AdvanceRoundDto,
  GenerateRoundDto,
  ResetDownstreamDto,
  UpdateSeedsDto,
} from './dto/bracket-operations.dto';
import { SwissService } from './swiss.service';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@ApiTags('brackets')
@Controller('rounds')
export class BracketsController {
  constructor(
    private readonly operations: BracketOperationsService,
    private readonly swiss: SwissService,
  ) {}

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('round:id')
  @Post(':id/generate')
  generate(
    @Param('id') id: string,
    @Query('force', new ParseBoolPipe({ optional: true })) force = false,
    @Body() dto?: GenerateRoundDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.operations.generate(id, force, dto?.previewToken, actorId);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('round:id')
  @Post(':id/generate-preview')
  previewGeneration(
    @Param('id') id: string,
    @Query('force', new ParseBoolPipe({ optional: true })) force = false,
  ) {
    return this.operations.previewGeneration(id, force);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('round:id')
  @Patch(':id/seeds')
  updateSeeds(
    @Param('id') id: string,
    @Body() dto: UpdateSeedsDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.operations.updateSeeds(id, dto, actorId);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('round:id')
  @ApiConflictResponse({
    description:
      'A manual organizer decision is required at a qualification tie boundary',
  })
  @Post(':id/advance')
  advance(
    @Param('id') id: string,
    @Body() dto: AdvanceRoundDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.operations.advance(id, dto?.qualifiedTeamIds, actorId);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('round:id')
  @Post(':id/reset-downstream-preview')
  previewDownstreamReset(@Param('id') id: string) {
    return this.operations.previewDownstreamReset(id);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('round:id')
  @ApiConflictResponse({
    description:
      'The reset preview is stale, no downstream data exists, or the Tournament is locked',
  })
  @Post(':id/reset-downstream')
  resetDownstream(
    @Param('id') id: string,
    @Body() dto: ResetDownstreamDto,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.operations.resetDownstream(id, dto.previewToken, actorId);
  }

  @ApiBearerAuth()
  @ApiOperation({ summary: 'Generate the next Swiss pairing round' })
  @ApiOkResponse({
    description: 'The next Swiss round was generated exactly once',
    schema: {
      example: {
        roundId: 'round-id',
        bracketRound: 2,
        numberOfRounds: 5,
        matchCount: 4,
        matchIds: ['match-id-1', 'match-id-2'],
        matches: [],
        bye: null,
        warnings: [],
      },
    },
  })
  @ApiUnauthorizedResponse({ description: 'Authentication is required' })
  @ApiForbiddenResponse({ description: 'Tournament organizer access required' })
  @ApiNotFoundResponse({ description: 'Round or tournament was not found' })
  @ApiBadRequestResponse({
    description:
      'Wrong format, incomplete current round, round limit reached, or insufficient teams',
  })
  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('round:id')
  @Post(':id/swiss/generate-next')
  generateNextSwissRound(
    @Param('id') id: string,
    @CurrentUser('id') actorId?: string,
  ) {
    return this.swiss.generateNextSwissRound(id, actorId);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('round:id')
  @ApiConflictResponse({
    description:
      'Round is not the unused final Round, or its Tournament is no longer mutable',
  })
  @Delete(':id')
  remove(@Param('id') id: string, @CurrentUser('id') actorId?: string) {
    return this.operations.remove(id, actorId);
  }

  @Get(':id/bracket')
  @UseGuards(OptionalJwtAuthGuard, VisibilityGuard)
  @VisibilityResource('round:id')
  getBracket(@Param('id') id: string) {
    return this.operations.getBracket(id);
  }
}
