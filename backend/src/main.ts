import { INestApplication, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import {
  configuredBrowserOrigins,
  configuredCorsOrigin,
} from './common/config/browser-origins';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import {
  assertProductionStorageConfiguration,
  storageDriver,
  UPLOAD_ROOT,
} from './uploads/upload.config';

export function configureStaticAssets(app: NestExpressApplication): void {
  if (storageDriver() !== 'local') return;
  app.useStaticAssets(UPLOAD_ROOT, {
    prefix: '/uploads/',
    dotfiles: 'deny',
    index: false,
  });
}

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.enableCors({
    origin: configuredCorsOrigin,
    credentials: true,
  });

  if (!isSwaggerEnabled()) return;

  const config = new DocumentBuilder()
    .setTitle('Esports Tournament Manager API')
    .setDescription('Backend API documentation')
    .setVersion('1.0')
    .addBearerAuth()
    .addCookieAuth('etm_refresh')
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    useGlobalPrefix: true,
    swaggerOptions: { withCredentials: true },
  });
}

export function isSwaggerEnabled(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const configured = env.SWAGGER_ENABLED?.trim().toLowerCase();
  if (configured !== undefined) return configured === 'true';
  return env.NODE_ENV !== 'production';
}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configuredBrowserOrigins();
  assertProductionStorageConfiguration();
  configureStaticAssets(app);
  configureApp(app);
  const port = process.env.PORT || 3001;
  await app.listen(port);
  console.log(`Backend running at: http://localhost:${port}/api`);
}

if (require.main === module) void bootstrap();
