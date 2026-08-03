import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GamesService {
  constructor(private prisma: PrismaService) {}

  /** Lấy danh sách game hỗ trợ (sắp theo tên) */
  async findAll() {
    return this.prisma.game.findMany({
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        iconUrl: true,
        teamSize: true,
      },
    });
  }
}
