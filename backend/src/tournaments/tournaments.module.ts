import { Module } from '@nestjs/common';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { CommonModule } from '../common/common.module';
import { BracketsModule } from '../brackets/brackets.module';
import { TournamentCommandService } from './tournament-command.service';
import { TournamentQueryService } from './tournament-query.service';
import { TournamentLifecyclePolicy } from './domain/tournament-lifecycle.policy';
import { TournamentModerationService } from './tournament-moderation.service';
import { NotificationModule } from '../notifications/notification.module';
import { TournamentFavoriteService } from './tournament-favorite.service';
import { TournamentFinalizationService } from './tournament-finalization.service';
import { TournamentRealtimeModule } from './tournament-realtime.module';

/**
 * Module Tournament — quản lý giải đấu (UC-U04, U05, U09, U10, U18)
 */
@Module({
  imports: [
    CommonModule,
    BracketsModule,
    NotificationModule,
    TournamentRealtimeModule,
  ],
  controllers: [TournamentsController],
  providers: [
    TournamentsService,
    TournamentCommandService,
    TournamentQueryService,
    TournamentLifecyclePolicy,
    TournamentModerationService,
    TournamentFavoriteService,
    TournamentFinalizationService,
  ],
  exports: [
    TournamentsService,
    TournamentCommandService,
    TournamentQueryService,
    TournamentModerationService,
    TournamentFinalizationService,
  ],
})
export class TournamentsModule {}
