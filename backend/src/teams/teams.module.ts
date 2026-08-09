import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { RegistrationValidatorService } from './registration-validator.service';
import { TeamAccessGuard } from './guards/team-access.guard';
import { CommonModule } from '../common/common.module';

/**
 * Module Team — đăng ký & quản lý hồ sơ đội (UC-U06, U07, U08, U11, U12, G06)
 */
@Module({
  imports: [CommonModule],
  controllers: [TeamsController],
  providers: [TeamsService, RegistrationValidatorService, TeamAccessGuard],
  exports: [TeamsService],
})
export class TeamsModule {}
