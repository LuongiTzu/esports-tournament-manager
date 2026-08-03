import { Module } from '@nestjs/common';
import { GamesController } from './games.controller';
import { GamesService } from './games.service';

/**
 * Module Game — danh mục tựa game hỗ trợ (dùng cho dropdown khi tạo giải)
 */
@Module({
  controllers: [GamesController],
  providers: [GamesService],
  exports: [GamesService],
})
export class GamesModule {}
