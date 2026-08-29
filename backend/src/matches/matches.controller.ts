import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
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

@Controller()
export class MatchesController {
  constructor(private readonly matches: MatchesService) {}

  @UseGuards(OptionalJwtAuthGuard, VisibilityGuard)
  @VisibilityResource('match:id')
  @Get('matches/:id')
  findOne(@Param('id') id: string) {
    return this.matches.findOne(id);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('matches:body')
  @Patch('matches/bulk-schedule')
  bulkSchedule(@Body() dto: BulkScheduleDto) {
    return this.matches.bulkSchedule(dto);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('match:id')
  @Patch('matches/:id')
  update(@Param('id') id: string, @Body() dto: UpdateMatchDto) {
    return this.matches.update(id, dto);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('match:id')
  @Put('matches/:id/scores')
  putScores(@Param('id') id: string, @Body() dto: PutMatchScoresDto) {
    return this.matches.putScores(id, dto);
  }

  @UseGuards(JwtAuthGuard, EmailVerifiedGuard, OwnershipGuard)
  @Ownership('round:id')
  @Post('rounds/:id/matches')
  createManual(@Param('id') id: string, @Body() dto: CreateManualMatchDto) {
    return this.matches.createManual(id, dto);
  }
}
