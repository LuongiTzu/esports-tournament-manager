import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { AdminModule } from './admin/admin.module';
import { UsersModule } from './users/users.module';
import { CommonModule } from './common/common.module';

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
  ],
})
export class AppModule {}
