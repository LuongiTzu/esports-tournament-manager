import { BadRequestException } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { join } from 'path';

export const UPLOAD_ROOT = join(process.cwd(), 'uploads');
export const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
};

mkdirSync(UPLOAD_ROOT, { recursive: true });

export const imageUploadOptions = {
  storage: diskStorage({
    destination: UPLOAD_ROOT,
    filename: (
      _request: Express.Request,
      file: Express.Multer.File,
      callback: (error: Error | null, filename: string) => void,
    ) => callback(null, `${randomUUID()}${EXTENSIONS[file.mimetype]}`),
  }),
  limits: { fileSize: MAX_IMAGE_SIZE, files: 1 },
  fileFilter: (
    _request: Express.Request,
    file: Express.Multer.File,
    callback: (error: Error | null, acceptFile: boolean) => void,
  ) => {
    if (!EXTENSIONS[file.mimetype]) {
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
