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
import { UpdateSeedsDto } from './dto/bracket-operations.dto';
import { SwissService } from './swiss.service';

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
  ) {
    return this.operations.generate(id, force);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('round:id')
  @Patch(':id/seeds')
  updateSeeds(@Param('id') id: string, @Body() dto: UpdateSeedsDto) {
    return this.operations.updateSeeds(id, dto);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('round:id')
  @Post(':id/advance')
  advance(@Param('id') id: string) {
    return this.operations.advance(id);
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
  generateNextSwissRound(@Param('id') id: string) {
    return this.swiss.generateNextSwissRound(id);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('round:id')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.operations.remove(id);
  }

  @Get(':id/bracket')
  @UseGuards(OptionalJwtAuthGuard, VisibilityGuard)
  @VisibilityResource('round:id')
  getBracket(@Param('id') id: string) {
    return this.operations.getBracket(id);
  }
}
