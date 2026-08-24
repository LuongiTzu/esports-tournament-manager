import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Ownership } from '../common/decorators/ownership.decorator';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { CreateTournamentNotificationDto } from './dto/notification.dto';
import { NotificationService } from './notification.service';
import { NotificationListQueryDto } from './dto/notification-list-query.dto';

@Controller()
export class NotificationController {
  constructor(private readonly notifications: NotificationService) {}

  @UseGuards(JwtAuthGuard, OwnershipGuard)
  @Ownership('slug:slug')
  @Post('tournaments/:slug/notifications')
  createForTournament(
    @Param('slug') slug: string,
    @Body() dto: CreateTournamentNotificationDto,
  ) {
    return this.notifications.createForTournament(slug, dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/me/notifications')
  findMine(
    @CurrentUser('id') userId: string,
    @Query()
    query: NotificationListQueryDto,
  ) {
    return this.notifications.findForUser(userId, query);
  }

  @UseGuards(JwtAuthGuard)
  @Get('users/me/notifications/unread-count')
  unreadCount(@CurrentUser('id') userId: string) {
    return this.notifications.unreadCount(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('notifications/read-all')
  markAllRead(@CurrentUser('id') userId: string) {
    return this.notifications.markAllRead(userId);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('notifications/:id/read')
  markRead(
    @CurrentUser('id') userId: string,
    @Param('id') notificationId: string,
  ) {
    return this.notifications.markRead(userId, notificationId);
  }
}
