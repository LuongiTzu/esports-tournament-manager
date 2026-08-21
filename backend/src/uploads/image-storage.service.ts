import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdir, unlink, writeFile } from 'fs/promises';
import { resolve, sep } from 'path';
import {
  IMAGE_EXTENSIONS,
  SupportedImageMime,
  UPLOAD_PUBLIC_PREFIX,
  UPLOAD_ROOT,
} from './upload.config';

export const IMAGE_CATEGORIES = [
  'user-avatars',
  'team-logos',
  'member-avatars',
  'tournament-banners',
] as const;

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

const OWNED_IMAGE_PATTERN = new RegExp(
  `^${UPLOAD_PUBLIC_PREFIX.replaceAll('/', '\\/')}(${IMAGE_CATEGORIES.join('|')})/([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(?:jpg|png|webp|gif))$`,
);

@Injectable()
export class ImageStorageService implements OnModuleInit {
  async onModuleInit(): Promise<void> {
    await Promise.all(
      IMAGE_CATEGORIES.map((category) =>
        mkdir(resolveCategoryDirectory(category), { recursive: true }),
      ),
    );
  }

  async store(
    category: ImageCategory,
    file: Express.Multer.File,
  ): Promise<{ url: string }> {
    const detectedMime = detectImageMime(file.buffer);
    if (!detectedMime || detectedMime !== file.mimetype) {
      throw new BadRequestException(
        'Image content does not match a supported file type',
      );
    }

    const directory = resolveCategoryDirectory(category);
    await mkdir(directory, { recursive: true });
    const filename = `${randomUUID()}${IMAGE_EXTENSIONS[detectedMime]}`;
    const destination = resolve(directory, filename);
    assertInside(directory, destination);
    await writeFile(destination, file.buffer, { flag: 'wx' });
    return { url: `${UPLOAD_PUBLIC_PREFIX}${category}/${filename}` };
  }

  async deleteOwned(
    url: string | null | undefined,
    expectedCategory: ImageCategory,
  ): Promise<void> {
    if (!url) return;
    const match = OWNED_IMAGE_PATTERN.exec(url);
    if (!match || match[1] !== expectedCategory) return;
    const directory = resolveCategoryDirectory(expectedCategory);
    const path = resolve(directory, match[2]);
    assertInside(directory, path);
    try {
      await unlink(path);
    } catch (error) {
      if (!isMissingFile(error)) throw error;
    }
  }
}

function resolveCategoryDirectory(category: ImageCategory): string {
  const directory = resolve(UPLOAD_ROOT, category);
  assertInside(UPLOAD_ROOT, directory);
  return directory;
}

function assertInside(parent: string, child: string): void {
  const prefix = parent.endsWith(sep) ? parent : `${parent}${sep}`;
  if (!child.startsWith(prefix)) {
    throw new BadRequestException('Invalid upload storage path');
  }
}

function detectImageMime(buffer?: Buffer): SupportedImageMime | null {
  if (!buffer) return null;
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 8 &&
    buffer
      .subarray(0, 8)
      .equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (
    buffer.length >= 6 &&
    ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))
  ) {
    return 'image/gif';
  }
  return null;
}

function isMissingFile(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === 'ENOENT'
  );
}
