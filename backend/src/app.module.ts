import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { UsersModule } from './users/users.module';
import { CommonModule } from './common/common.module';
import { GamesModule } from './games/games.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { TeamsModule } from './teams/teams.module';

@Module({
  imports: [
    // Load biến môi trường từ .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    // Prisma global
    PrismaModule,
    // Auth
    AuthModule,
    // Admin (quản trị hệ thống - RBAC)
    AdminModule,
    // Users (quản lý hồ sơ cá nhân - UC-U03)
    UsersModule,
    // Common (guard/decorator dùng chung)
    CommonModule,
    // Games (danh mục tựa game - UC-G02)
    GamesModule,
    // Tournaments (quản lý giải đấu - UC-U04, U05, U09, U10, U18)
    TournamentsModule,
    // Teams (đăng ký & duyệt đội - UC-U06, U07, U08, U11, U12)
    TeamsModule,
  ],
})
export class AppModule {}
