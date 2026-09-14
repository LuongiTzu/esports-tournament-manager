import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { RatingController, AdminRatingController } from './rating.controller';
import { RatingService } from './rating.service';

@Module({
  imports: [CommonModule],
  controllers: [RatingController, AdminRatingController],
  providers: [RatingService],
})
export class RatingModule {}
