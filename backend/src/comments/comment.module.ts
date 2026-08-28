import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { CommentController } from './comment.controller';
import { CommentService } from './comment.service';
import { TournamentRealtimeModule } from '../tournaments/tournament-realtime.module';
import { CommentModerationService } from './comment-moderation.service';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [CommonModule, TournamentRealtimeModule, NotificationModule],
  controllers: [CommentController],
  providers: [CommentService, CommentModerationService],
  exports: [CommentService, CommentModerationService],
})
export class CommentModule {}
