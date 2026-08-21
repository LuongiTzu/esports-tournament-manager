import { Module } from '@nestjs/common';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { ImageStorageService } from './image-storage.service';

@Module({
  controllers: [UploadController],
  providers: [UploadService, ImageStorageService],
  exports: [ImageStorageService],
})
export class UploadModule {}
