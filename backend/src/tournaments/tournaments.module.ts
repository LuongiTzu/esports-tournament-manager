import { Module } from '@nestjs/common';
import { AssistantController } from './assistant/assistant.controller';
import { AssistantService } from './assistant/assistant.service';
import { AssistantContextService } from './assistant/assistant-context.service';
import { AssistantRecordsService } from './assistant/assistant-records.service';
import { AssistantProposalService } from './assistant/assistant-proposal.service';
import { AiModule } from '../ai/ai.module';
import { TournamentAiSearchController } from './tournament-ai-search.controller';
import { TournamentAiSearchService } from './tournament-ai-search.service';
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
import { TournamentAdminOverrideService } from './tournament-admin-override.service';
import { TournamentStaffService } from './tournament-staff.service';
import { TournamentCloneService } from './tournament-clone.service';

/**
 * Module Tournament — quản lý giải đấu (UC-U04, U05, U09, U10, U18)
 */
@Module({
  imports: [
    AiModule,
    CommonModule,
    BracketsModule,
    NotificationModule,
    TournamentRealtimeModule,
  ],
  controllers: [
    TournamentsController,
    TournamentAiSearchController,
    AssistantController,
  ],
  providers: [
    AssistantService,
    AssistantContextService,
    AssistantRecordsService,
    AssistantProposalService,
    TournamentAiSearchService,
    TournamentsService,
    TournamentCommandService,
    TournamentQueryService,
    TournamentLifecyclePolicy,
    TournamentModerationService,
    TournamentFavoriteService,
    TournamentFinalizationService,
    TournamentAdminOverrideService,
    TournamentStaffService,
    TournamentCloneService,
  ],
  exports: [
    TournamentsService,
    TournamentCommandService,
    TournamentQueryService,
    TournamentModerationService,
    TournamentFinalizationService,
    TournamentAdminOverrideService,
  ],
})
export class TournamentsModule {}
