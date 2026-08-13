import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { NotificationModule } from '../notifications/notification.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 5 }]),
    NotificationModule,
  ],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
