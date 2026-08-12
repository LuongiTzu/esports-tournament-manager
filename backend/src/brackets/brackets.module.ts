import { Module } from '@nestjs/common';
import { RoundSettingsService } from './round-settings.service';
import { BracketsService } from './brackets.service';
import { RoundRobinGenerator } from './generators/round-robin.generator';
import { GroupStageGenerator } from './generators/group-stage.generator';
import { SwissGenerator } from './generators/swiss.generator';
import { PlayoffGenerator } from './generators/playoff.generator';
import { DoubleElimGenerator } from './generators/double-elim.generator';
import { GroupStagePersistenceService } from './group-stage-persistence.service';
import { SwissService } from './swiss.service';
import { StandingsService } from './standings.service';
import { BracketOperationsService } from './bracket-operations.service';
import { BracketsController } from './brackets.controller';

/**
 * Module Bracket — chứa toàn bộ logic sinh bracket & chuẩn hóa settings.
 *
 * GĐ 5.1: RoundSettingsService (validate/normalize settings theo format).
 * GĐ 5.2+: các generator (round-robin, group-stage, swiss, playoff, double-elim)
 * cùng BracketsService, BracketsController.
 *
 * `exports` giúp các module khác (vd. TournamentsModule khi tạo Round)
 * dùng được RoundSettingsService.
 */
@Module({
  controllers: [BracketsController],
  providers: [
    RoundSettingsService,
    BracketsService,
    RoundRobinGenerator,
    GroupStageGenerator,
    SwissGenerator,
    PlayoffGenerator,
    DoubleElimGenerator,
    GroupStagePersistenceService,
    SwissService,
    StandingsService,
    BracketOperationsService,
  ],
  exports: [
    RoundSettingsService,
    BracketsService,
    GroupStagePersistenceService,
    SwissService,
    StandingsService,
    BracketOperationsService,
  ],
})
export class BracketsModule {}
