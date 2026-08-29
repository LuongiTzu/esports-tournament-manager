import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { ActivityEmailService } from './activity-email.service';
import { ACTIVITY_EMAIL_PUBLISHER } from '../common/ports/activity-email-publisher';

@Module({
  providers: [
    EmailService,
    ActivityEmailService,
    {
      provide: ACTIVITY_EMAIL_PUBLISHER,
      useExisting: ActivityEmailService,
    },
  ],
  exports: [EmailService, ACTIVITY_EMAIL_PUBLISHER],
})
export class EmailModule {}
