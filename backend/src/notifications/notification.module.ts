import { Global, Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { NotificationController } from './notification.controller';
import { NotificationEventsService } from './notification-events.service';
import { NotificationService } from './notification.service';

@Global()
@Module({
  imports: [CommonModule],
  controllers: [NotificationController],
  providers: [NotificationService, NotificationEventsService],
  exports: [NotificationService, NotificationEventsService],
})
export class NotificationModule {}
