import { BadRequestException } from '@nestjs/common';
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
  const service = new ImageStorageService();
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
});
