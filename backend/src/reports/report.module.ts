import { Module } from '@nestjs/common';
import { NotificationModule } from '../notifications/notification.module';
import { ReportController } from './report.controller';
import { ReportService } from './report.service';

@Module({
  imports: [NotificationModule],
  controllers: [ReportController],
  providers: [ReportService],
  exports: [ReportService],
})
export class ReportModule {}
