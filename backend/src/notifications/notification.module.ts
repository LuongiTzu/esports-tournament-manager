import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { NotificationController } from './notification.controller';
import { NotificationEventsService } from './notification-events.service';
import { NotificationService } from './notification.service';
import { NOTIFICATION_PUBLISHER } from '../common/ports/notification-publisher';
import { NotificationQueryService } from './notification-query.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [CommonModule, EmailModule],
  controllers: [NotificationController],
  providers: [
    NotificationService,
    NotificationEventsService,
    NotificationQueryService,
    { provide: NOTIFICATION_PUBLISHER, useExisting: NotificationService },
  ],
  exports: [
    NotificationEventsService,
    NotificationQueryService,
    NOTIFICATION_PUBLISHER,
  ],
})
export class NotificationModule {}
