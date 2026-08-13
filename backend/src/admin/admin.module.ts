import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { CommonModule } from '../common/common.module';
import { NotificationModule } from '../notifications/notification.module';

@Module({
  imports: [CommonModule, NotificationModule],
  controllers: [AdminController],
  providers: [AdminService],
  exports: [AdminService],
})
export class AdminModule {}
