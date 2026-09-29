import {
  DeleteObjectCommand,
  HeadBucketCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import {
  BadRequestException,
  Injectable,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { access, mkdir, unlink, writeFile } from 'fs/promises';
import { constants } from 'fs';
import { resolve, sep } from 'path';
import {
  IMAGE_EXTENSIONS,
  SupportedImageMime,
  UPLOAD_PUBLIC_PREFIX,
  UPLOAD_ROOT,
  storageDriver,
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
  private s3Client?: S3Client;

  constructor(@Optional() private readonly config?: ConfigService) {}

  async onModuleInit(): Promise<void> {
    if (this.driver() === 's3') {
      this.s3();
      return;
    }
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

    const filename = `${randomUUID()}${IMAGE_EXTENSIONS[detectedMime]}`;
    if (this.driver() === 's3') {
      const key = `${category}/${filename}`;
      await this.s3().send(
        new PutObjectCommand({
          Bucket: this.required('S3_BUCKET'),
          Key: key,
          Body: file.buffer,
          ContentType: detectedMime,
          CacheControl: 'public, max-age=31536000, immutable',
        }),
      );
      return { url: `${this.publicBaseUrl()}/${key}` };
    }

    const directory = resolveCategoryDirectory(category);
    await mkdir(directory, { recursive: true });
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
    if (this.driver() === 's3') {
      const key = this.ownedObjectKey(url, expectedCategory);
      if (!key) return;
      await this.s3().send(
        new DeleteObjectCommand({
          Bucket: this.required('S3_BUCKET'),
          Key: key,
        }),
      );
      return;
    }

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

  async checkHealth(): Promise<void> {
    if (this.driver() === 's3') {
      await this.s3().send(
        new HeadBucketCommand({ Bucket: this.required('S3_BUCKET') }),
      );
      return;
    }

    await mkdir(UPLOAD_ROOT, { recursive: true });
    await access(UPLOAD_ROOT, constants.R_OK | constants.W_OK);
  }

  private driver() {
    const configured = this.value('STORAGE_DRIVER');
    return configured?.toLowerCase() === 's3' ? 's3' : storageDriver();
  }

  private s3(): S3Client {
    if (this.s3Client) return this.s3Client;
    const accessKeyId = this.value('S3_ACCESS_KEY_ID');
    const secretAccessKey = this.value('S3_SECRET_ACCESS_KEY');
    const endpoint = this.value('S3_ENDPOINT');
    this.s3Client = new S3Client({
      region: this.value('S3_REGION') ?? 'us-east-1',
      ...(endpoint ? { endpoint } : {}),
      forcePathStyle: this.value('S3_FORCE_PATH_STYLE') === 'true',
      ...(accessKeyId && secretAccessKey
        ? { credentials: { accessKeyId, secretAccessKey } }
        : {}),
    });
    return this.s3Client;
  }

  private publicBaseUrl(): string {
    return this.required('S3_PUBLIC_URL').replace(/\/$/, '');
  }

  private ownedObjectKey(
    url: string,
    expectedCategory: ImageCategory,
  ): string | null {
    const prefix = `${this.publicBaseUrl()}/`;
    if (!url.startsWith(prefix)) return null;
    const key = url.slice(prefix.length);
    const pattern = new RegExp(
      `^${expectedCategory}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\\.(?:jpg|png|webp|gif)$`,
    );
    return pattern.test(key) ? key : null;
  }

  private required(key: string): string {
    const value = this.value(key);
    if (!value) throw new Error(`${key} is required when STORAGE_DRIVER=s3`);
    return value;
  }

  private value(key: string): string | undefined {
    return this.config?.get<string>(key) ?? process.env[key];
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
