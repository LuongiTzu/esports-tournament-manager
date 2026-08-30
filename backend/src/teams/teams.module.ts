import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { RegistrationValidatorService } from './registration-validator.service';
import { TeamAccessGuard } from './guards/team-access.guard';
import { CommonModule } from '../common/common.module';
import { TeamReviewPolicy } from './domain/team-review.policy';
import { RegistrationRosterPolicy } from './domain/registration-roster.policy';
import { TeamQueryService } from './team-query.service';
import { TeamReviewService } from './team-review.service';
import { TournamentRealtimeModule } from '../tournaments/tournament-realtime.module';
import { NotificationModule } from '../notifications/notification.module';
import { EmailModule } from '../email/email.module';
import { TeamInvitationService } from './team-invitation.service';
import { TeamInvitationTokenService } from './team-invitation-token.service';

/**
 * Module Team — đăng ký & quản lý hồ sơ đội (UC-U06, U07, U08, U11, U12, G06)
 */
@Module({
  imports: [
    CommonModule,
    TournamentRealtimeModule,
    NotificationModule,
    EmailModule,
  ],
  controllers: [TeamsController],
  providers: [
    TeamsService,
    RegistrationValidatorService,
    TeamAccessGuard,
    TeamReviewPolicy,
    RegistrationRosterPolicy,
    TeamQueryService,
    TeamReviewService,
    TeamInvitationService,
    TeamInvitationTokenService,
  ],
  exports: [TeamsService, TeamQueryService, TeamReviewService],
})
export class TeamsModule {}
