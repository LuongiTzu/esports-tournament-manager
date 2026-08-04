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
   * Lấy danh sách game hỗ trợ kèm genre + positions (UC-G01, UC-G02)
   */
  @Get()
  findAll() {
    return this.gamesService.findAll();
  }

  /**
   * GET /api/games/:id/positions
   * Danh sách vị trí thi đấu của 1 game — FE render dropdown động trong form đăng ký đội
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
