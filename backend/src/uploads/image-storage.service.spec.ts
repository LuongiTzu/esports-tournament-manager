import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { existsSync } from 'fs';
import { join } from 'path';
import { ImageStorageService } from './image-storage.service';
import { UPLOAD_ROOT } from './upload.config';

function file(
  mimetype: string,
  buffer: Buffer,
  originalname = '../../client-name.png',
): Express.Multer.File {
  return {
    fieldname: 'file',
    originalname,
    encoding: '7bit',
    mimetype,
    size: buffer.length,
    destination: '',
    filename: '',
    path: '',
    buffer,
    stream: undefined as never,
  };
}

describe('ImageStorageService', () => {
  const config = {
    get: jest.fn((key: string) =>
      key === 'STORAGE_DRIVER' ? 'local' : undefined,
    ),
  } as unknown as ConfigService;
  const service = new ImageStorageService(config);
  const createdUrls: string[] = [];

  beforeAll(() => service.onModuleInit());

  afterEach(async () => {
    await Promise.all(
      createdUrls
        .splice(0)
        .map((url) => service.deleteOwned(url, 'team-logos')),
    );
  });

  it('ignores the client path and uses a UUID filename inside its category', async () => {
    const stored = await service.store(
      'team-logos',
      file(
        'image/png',
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    );
    createdUrls.push(stored.url);

    expect(stored.url).toMatch(/^\/uploads\/team-logos\/[0-9a-f-]{36}\.png$/);
    expect(
      existsSync(join(UPLOAD_ROOT, stored.url.replace('/uploads/', ''))),
    ).toBe(true);
    expect(stored.url).not.toContain('client-name');
    expect(stored.url).not.toContain('..');
  });

  it('rejects a declared MIME that does not match the file signature', async () => {
    await expect(
      service.store(
        'team-logos',
        file('image/jpeg', Buffer.from('RIFF0000WEBP', 'ascii')),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('deletes only generated URLs owned by the expected category', async () => {
    const stored = await service.store(
      'team-logos',
      file('image/jpeg', Buffer.from([0xff, 0xd8, 0xff, 0xdb])),
    );
    const path = join(UPLOAD_ROOT, stored.url.replace('/uploads/', ''));

    await service.deleteOwned('https://cdn.example.com/logo.jpg', 'team-logos');
    await service.deleteOwned(stored.url, 'user-avatars');
    expect(existsSync(path)).toBe(true);

    await service.deleteOwned(stored.url, 'team-logos');
    expect(existsSync(path)).toBe(false);
  });

  it('stores, checks and deletes owned images through S3-compatible storage', async () => {
    const send = jest
      .spyOn(S3Client.prototype, 'send')
      .mockResolvedValue({} as never);
    const values: Record<string, string> = {
      STORAGE_DRIVER: 's3',
      S3_ENDPOINT: 'http://minio:9000',
      S3_REGION: 'us-east-1',
      S3_BUCKET: 'arenaverse',
      S3_ACCESS_KEY_ID: 'access',
      S3_SECRET_ACCESS_KEY: 'secret',
      S3_FORCE_PATH_STYLE: 'true',
      S3_PUBLIC_URL: 'https://arena.example/storage',
    };
    const s3Storage = new ImageStorageService({
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService);

    await s3Storage.onModuleInit();
    const stored = await s3Storage.store(
      'team-logos',
      file(
        'image/png',
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      ),
    );
    await s3Storage.checkHealth();
    await s3Storage.deleteOwned(stored.url, 'team-logos');

    expect(stored.url).toMatch(
      /^https:\/\/arena\.example\/storage\/team-logos\/[0-9a-f-]{36}\.png$/,
    );
    expect(send.mock.calls[0][0]).toBeInstanceOf(PutObjectCommand);
    expect(send.mock.calls[1][0]).toBeInstanceOf(HeadBucketCommand);
    expect(send.mock.calls[2][0]).toBeInstanceOf(DeleteObjectCommand);
    send.mockRestore();
  });
});
