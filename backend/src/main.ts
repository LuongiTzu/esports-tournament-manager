import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Global prefix cho tất cả routes
  app.setGlobalPrefix('api');

  // Global validation pipe (kích hoạt class-validator)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Loại bỏ field không khai báo trong DTO
      forbidNonWhitelisted: true, // Báo lỗi nếu có field lạ
      transform: true, // Tự động chuyển đổi kiểu dữ liệu
    }),
  );

  // CORS - cho phép frontend kết nối
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`🚀 Backend đang chạy tại: http://localhost:${port}/api`);
}
void bootstrap();
