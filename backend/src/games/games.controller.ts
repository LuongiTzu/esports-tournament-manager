import { Controller, Get } from '@nestjs/common';
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
   * Lấy danh sách game hỗ trợ (UC-G01, UC-G02 — dropdown tạo giải)
   */
  @Get()
  findAll() {
    return this.gamesService.findAll();
  }
}
