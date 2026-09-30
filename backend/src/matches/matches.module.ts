import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { MatchResultPolicy } from './domain/match-result.policy';
import { MatchQueryService } from './match-query.service';
import { MatchResultService } from './match-result.service';
import { MatchSchedulingService } from './match-scheduling.service';
import { CompetitionProgressionService } from './competition-progression.service';
import { NotificationModule } from '../notifications/notification.module';
import { TournamentRealtimeModule } from '../tournaments/tournament-realtime.module';
import { BracketsModule } from '../brackets/brackets.module';
import { MatchCheckInService } from './match-check-in.service';

@Module({
  imports: [
    CommonModule,
    NotificationModule,
    TournamentRealtimeModule,
    BracketsModule,
  ],
  controllers: [MatchesController],
  providers: [
    MatchesService,
    MatchQueryService,
    MatchSchedulingService,
    MatchResultService,
    MatchResultPolicy,
    CompetitionProgressionService,
    MatchCheckInService,
  ],
  exports: [
    MatchesService,
    MatchQueryService,
    MatchSchedulingService,
    MatchResultService,
    CompetitionProgressionService,
  ],
})
export class MatchesModule {}
