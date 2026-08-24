import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CommonModule } from '../common/common.module';
import {
  AdminDashboardQueryService,
  BannedKeywordService,
} from './admin-operations.services';
import { UsersModule } from '../users/users.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { ReportModule } from '../reports/report.module';
import { CommentModule } from '../comments/comment.module';

@Module({
  imports: [
    CommonModule,
    UsersModule,
    TournamentsModule,
    ReportModule,
    CommentModule,
  ],
  controllers: [AdminController],
  providers: [AdminService, AdminDashboardQueryService, BannedKeywordService],
  exports: [AdminService],
})
export class AdminModule {}
