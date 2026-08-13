import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { writeFile } from 'fs/promises';
import { join } from 'path';
import { AppModule } from '../src/app.module';

async function exportOpenApi() {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.setGlobalPrefix('api');
  const config = new DocumentBuilder()
    .setTitle('Esports Tournament Manager API')
    .setDescription('Backend API contract')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  await writeFile(
    join(process.cwd(), 'openapi.json'),
    `${JSON.stringify(document, null, 2)}\n`,
    'utf8',
  );
  await app.close();
}

void exportOpenApi();
