import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const publicTeamSelect = {
  id: true,
  name: true,
  shortName: true,
  logoUrl: true,
  seed: true,
} as const;

@Injectable()
export class MatchQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        scores: { orderBy: { setNumber: 'asc' } },
        teamA: { select: publicTeamSelect },
        teamB: { select: publicTeamSelect },
        winner: { select: publicTeamSelect },
        round: {
          select: {
            id: true,
            name: true,
            format: true,
            tournament: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }
}
