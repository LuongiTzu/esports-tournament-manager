import { Module } from '@nestjs/common';
import { NotificationModule } from '../notifications/notification.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';
import { ReportReviewService } from './report-review.service';

@Module({
  imports: [NotificationModule],
  controllers: [ReportController],
  providers: [ReportService, ReportReviewService],
  exports: [ReportService, ReportReviewService],
})
export class ReportModule {}
