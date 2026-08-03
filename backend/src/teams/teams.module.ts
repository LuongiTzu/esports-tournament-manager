import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { CommonModule } from '../common/common.module';

/**
 * Module Team — quản lý đội tham gia giải (UC-U06, U07, U08, U11, U12)
 */
@Module({
  imports: [CommonModule],
  controllers: [TeamsController],
  providers: [TeamsService],
  exports: [TeamsService],
})
export class TeamsModule {}
