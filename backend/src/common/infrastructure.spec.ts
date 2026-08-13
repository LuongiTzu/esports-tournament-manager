/* eslint-disable @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access */
import {
  Body,
  Controller,
  INestApplication,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { existsSync, unlinkSync } from 'fs';
import request from 'supertest';
import { configureApp } from '../main';
import { imageUploadOptions, UPLOAD_ROOT } from '../uploads/upload.config';
import { join } from 'path';

class NestedDto {
  @IsString()
  @MinLength(3)
  value!: string;
}

class ValidationDto {
  @ValidateNested()
  @Type(() => NestedDto)
  nested!: NestedDto;
}

@Controller('infrastructure-test')
class InfrastructureController {
  @Post('upload')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  upload(@UploadedFile() file: Express.Multer.File) {
    return { url: `/uploads/${file.filename}` };
  }

  @Post('validation')
  validate(@Body() body: ValidationDto) {
    return body;
  }
}

describe('backend infrastructure', () => {
  let app: INestApplication;
  const createdFiles: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InfrastructureController],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    for (const filename of createdFiles) {
      const path = join(UPLOAD_ROOT, filename);
      if (existsSync(path)) unlinkSync(path);
    }
  });

  it('rejects invalid upload types with the global error shape', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/infrastructure-test/upload')
      .attach('file', Buffer.from('not an image'), {
        filename: '../unsafe.txt',
        contentType: 'text/plain',
      })
      .expect(400);
    expect(response.body).toEqual({
      statusCode: 400,
      message: 'Only JPEG, PNG, WebP and GIF images are allowed',
      errors: [],
    });
  });

  it('stores a valid upload under a generated safe filename', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/infrastructure-test/upload')
      .attach('file', Buffer.from([0x89, 0x50, 0x4e, 0x47]), {
        filename: '../../avatar.png',
        contentType: 'image/png',
      })
      .expect(201);
    const url = (response.body as { data: { url: string } }).data.url;
    const filename = url.replace('/uploads/', '');
    createdFiles.push(filename);
    expect(filename).toMatch(/^[0-9a-f-]{36}\.png$/);
    expect(existsSync(join(UPLOAD_ROOT, filename))).toBe(true);
  });

  it('serves Swagger at the configured API docs path', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });

  it('keeps nested validation messages in errors', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/infrastructure-test/validation')
      .send({ nested: { value: 'x' } })
      .expect(400);
    expect(response.body.statusCode).toBe(400);
    expect(response.body.message).toBe('Validation failed');
    expect(response.body.errors).toEqual(
      expect.arrayContaining([expect.stringContaining('nested.value')]),
    );
  });
});
