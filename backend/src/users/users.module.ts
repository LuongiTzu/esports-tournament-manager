import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { UserAdministrationService } from './user-administration.service';
import { EmailModule } from '../email/email.module';

@Module({
  imports: [TournamentsModule, EmailModule],
  controllers: [UsersController],
  providers: [UsersService, UserAdministrationService],
  exports: [UsersService, UserAdministrationService],
})
export class UsersModule {}
