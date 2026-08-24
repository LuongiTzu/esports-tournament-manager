import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TournamentEventsService } from './tournament-events.service';
import { TournamentGateway } from './tournament.gateway';
import { NotificationModule } from '../notifications/notification.module';
import { TOURNAMENT_EVENT_PUBLISHER } from '../common/ports/tournament-event-publisher';

@Module({
  imports: [AuthModule, NotificationModule],
  providers: [
    TournamentEventsService,
    TournamentGateway,
    {
      provide: TOURNAMENT_EVENT_PUBLISHER,
      useExisting: TournamentEventsService,
    },
  ],
  exports: [TOURNAMENT_EVENT_PUBLISHER],
})
export class TournamentRealtimeModule {}
