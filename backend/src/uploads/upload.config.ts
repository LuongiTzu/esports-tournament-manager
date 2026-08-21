import { BadRequestException } from '@nestjs/common';
import { mkdirSync } from 'fs';
import { memoryStorage } from 'multer';
import { join, resolve } from 'path';

export const UPLOAD_ROOT = resolve(
  process.env.UPLOAD_DIR ?? join(process.cwd(), 'uploads'),
);
export const UPLOAD_PUBLIC_PREFIX = '/uploads/';
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
export const IMAGE_EXTENSIONS = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
} as const;

export type SupportedImageMime = keyof typeof IMAGE_EXTENSIONS;

mkdirSync(UPLOAD_ROOT, { recursive: true });

export const imageUploadOptions = {
  // Keep the bounded file in memory until authorization has passed and its
  // signature has been verified. Business services then persist it atomically.
  storage: memoryStorage(),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
  fileFilter: (
    _request: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!(file.mimetype in IMAGE_EXTENSIONS)) {
      return callback(
        new BadRequestException(
          'Only JPEG, PNG, WebP and GIF images are allowed',
        ),
        false,
      );
    }
    callback(null, true);
  },
};
