import { Global, Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { TournamentEventsService } from './tournament-events.service';
import { TournamentGateway } from './tournament.gateway';
import { NotificationModule } from '../notifications/notification.module';

@Global()
@Module({
  imports: [AuthModule, NotificationModule],
  providers: [TournamentEventsService, TournamentGateway],
  exports: [TournamentEventsService],
})
export class TournamentRealtimeModule {}
