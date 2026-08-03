import { Module } from '@nestjs/common';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { CommonModule } from '../common/common.module';

/**
 * Module Tournament — quản lý giải đấu (UC-U04, U05, U09, U10, U18)
 */
@Module({
  imports: [CommonModule],
  controllers: [TournamentsController],
  providers: [TournamentsService],
  exports: [TournamentsService],
})
export class TournamentsModule {}
