import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { UsersModule } from './users/users.module';
import { CommonModule } from './common/common.module';
import { GamesModule } from './games/games.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { TeamsModule } from './teams/teams.module';
import { MatchesModule } from './matches/matches.module';
import { TournamentRealtimeModule } from './tournaments/tournament-realtime.module';
import { NotificationModule } from './notifications/notification.module';
import { CommentModule } from './comments/comment.module';
import { ReportModule } from './reports/report.module';
import { UploadModule } from './uploads/upload.module';

@Module({
  imports: [
    // Load biến môi trường từ .env
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ThrottlerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => [
        {
          ttl: config.get<number>('RATE_LIMIT_TTL_MS', 60_000),
          limit: config.get<number>('RATE_LIMIT_GLOBAL', 100),
        },
      ],
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
    MatchesModule,
    NotificationModule,
    CommentModule,
    ReportModule,
    TournamentRealtimeModule,
    UploadModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
