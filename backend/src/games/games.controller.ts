import { Controller, Get, Param } from '@nestjs/common';
import { GamesService } from './games.service';

/**
 * Controller Game — danh mục game hỗ trợ
 * Không yêu cầu đăng nhập (dùng cho dropdown tạo giải)
 */
@Controller('games')
export class GamesController {
  constructor(private gamesService: GamesService) {}

  /**
   * GET /api/games
   * Lấy danh sách game active kèm genre + position metadata (UC-G01, UC-G02)
   */
  @Get()
  findAll() {
    return this.gamesService.findAll();
  }

  /**
   * GET /api/games/:id/positions
   * Mã vị trí và chế độ fixed/optional/none của một game
   */
  @Get(':id/positions')
  findPositions(@Param('id') id: string) {
    return this.gamesService.findPositions(id);
  }

  /**
   * GET /api/games/:id
   * Chi tiết 1 game
   */
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.gamesService.findOne(id);
  }
}
