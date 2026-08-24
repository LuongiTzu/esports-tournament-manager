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

/**
 * Module Tournament — quản lý giải đấu (UC-U04, U05, U09, U10, U18)
 */
@Module({
  imports: [CommonModule, BracketsModule, NotificationModule],
  controllers: [TournamentsController],
  providers: [
    TournamentsService,
    TournamentCommandService,
    TournamentQueryService,
    TournamentLifecyclePolicy,
    TournamentModerationService,
  ],
  exports: [
    TournamentsService,
    TournamentCommandService,
    TournamentQueryService,
    TournamentModerationService,
  ],
})
export class TournamentsModule {}
