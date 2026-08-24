import { Module } from '@nestjs/common';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { CommonModule } from '../common/common.module';
import { BracketsModule } from '../brackets/brackets.module';
import { TournamentCommandService } from './tournament-command.service';
import { TournamentQueryService } from './tournament-query.service';
import { TournamentLifecyclePolicy } from './domain/tournament-lifecycle.policy';

/**
 * Module Tournament — quản lý giải đấu (UC-U04, U05, U09, U10, U18)
 */
@Module({
  imports: [CommonModule, BracketsModule],
  controllers: [TournamentsController],
  providers: [
    TournamentsService,
    TournamentCommandService,
    TournamentQueryService,
    TournamentLifecyclePolicy,
  ],
  exports: [
    TournamentsService,
    TournamentCommandService,
    TournamentQueryService,
  ],
})
export class TournamentsModule {}
