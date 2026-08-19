import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { GAME_CATALOG_NAMES } from './game-catalog';

/** Field công khai của Game — dùng chung cho mọi query */
const GAME_SELECT = {
  id: true,
  name: true,
  iconUrl: true,
  genre: true,
  positions: true,
  positionMode: true,
  defaultTeamSize: true,
  minTeamSize: true,
  maxTeamSize: true,
} as const;

@Injectable()
export class GamesService {
  constructor(private prisma: PrismaService) {}

  /** Lấy danh sách game hỗ trợ (sắp theo tên) */
  async findAll() {
    return this.prisma.game.findMany({
      where: { name: { in: GAME_CATALOG_NAMES } },
      orderBy: { name: 'asc' },
      select: GAME_SELECT,
    });
  }

  /** Lấy chi tiết 1 game */
  async findOne(id: string) {
    const game = await this.prisma.game.findFirst({
      where: { id, name: { in: GAME_CATALOG_NAMES } },
      select: GAME_SELECT,
    });

    if (!game) {
      throw new NotFoundException('Không tìm thấy game');
    }

    return game;
  }

  /** Danh sách vị trí thi đấu của 1 game (FE render dropdown động) */
  async findPositions(id: string) {
    const game = await this.findOne(id);

    return {
      gameId: game.id,
      name: game.name,
      genre: game.genre,
      positions: (game.positions as string[] | null) ?? [],
      positionMode: game.positionMode,
    };
  }
}
