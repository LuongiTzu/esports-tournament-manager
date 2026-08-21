/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Body,
  Controller,
  Post,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { NestExpressApplication } from '@nestjs/platform-express';
import { Test } from '@nestjs/testing';
import { IsString, MinLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { existsSync, unlinkSync } from 'fs';
import request from 'supertest';
import { configureApp, configureStaticAssets } from '../main';
import {
  imageUploadOptions,
  MAX_IMAGE_SIZE,
  UPLOAD_ROOT,
} from '../uploads/upload.config';
import { ImageStorageService } from '../uploads/image-storage.service';
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
  constructor(private readonly storage: ImageStorageService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', imageUploadOptions))
  upload(@UploadedFile() file: Express.Multer.File) {
    return this.storage.store('user-avatars', file);
  }

  @Post('validation')
  validate(@Body() body: ValidationDto) {
    return body;
  }
}

describe('backend infrastructure', () => {
  let app: NestExpressApplication;
  const createdFiles: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [InfrastructureController],
      providers: [ImageStorageService],
    }).compile();
    app = moduleRef.createNestApplication<NestExpressApplication>();
    configureStaticAssets(app);
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

  it.each([
    ['JPEG', 'image/jpeg', 'jpg', Buffer.from([0xff, 0xd8, 0xff, 0xdb, 0x00])],
    [
      'PNG',
      'image/png',
      'png',
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ],
    ['WebP', 'image/webp', 'webp', Buffer.from('RIFF0000WEBP', 'ascii')],
  ])(
    'stores and publicly serves a valid %s under a generated safe filename',
    async (_label, contentType, extension, contents) => {
      const response = await request(app.getHttpServer())
        .post('/api/infrastructure-test/upload')
        .attach('file', contents, {
          filename: `../../unsafe.${extension}`,
          contentType,
        })
        .expect(201);
      const url = (response.body as { data: { url: string } }).data.url;
      const filename = url.replace('/uploads/', '');
      createdFiles.push(filename);
      expect(filename).toMatch(
        new RegExp(`^user-avatars/[0-9a-f-]{36}\\.${extension}$`),
      );
      expect(existsSync(join(UPLOAD_ROOT, filename))).toBe(true);
      await request(app.getHttpServer()).get(url).expect(200, contents);
    },
  );

  it('rejects a spoofed image MIME when file contents do not match', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/infrastructure-test/upload')
      .attach('file', Buffer.from('not really a PNG'), {
        filename: 'spoofed.png',
        contentType: 'image/png',
      })
      .expect(400);

    expect(response.body.message).toBe(
      'Image content does not match a supported file type',
    );
  });

  it('rejects an oversized image before storage', async () => {
    const contents = Buffer.alloc(MAX_IMAGE_SIZE + 1);
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(
      contents,
    );
    await request(app.getHttpServer())
      .post('/api/infrastructure-test/upload')
      .attach('file', contents, {
        filename: 'oversized.png',
        contentType: 'image/png',
      })
      .expect(413);
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
