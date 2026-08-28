import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TournamentFavoriteService {
  constructor(private readonly prisma: PrismaService) {}

  async favorite(userId: string, slug: string) {
    const tournament = await this.resolveTournament(slug);
    return this.prisma.$transaction(async (tx) => {
      await tx.tournamentFavorite.createMany({
        data: [{ userId, tournamentId: tournament.id }],
        skipDuplicates: true,
      });
      const favoriteCount = await tx.tournamentFavorite.count({
        where: { tournamentId: tournament.id },
      });
      return { isFavorited: true, favoriteCount };
    });
  }

  async unfavorite(userId: string, slug: string) {
    const tournament = await this.resolveTournament(slug);
    return this.prisma.$transaction(async (tx) => {
      await tx.tournamentFavorite.deleteMany({
        where: { userId, tournamentId: tournament.id },
      });
      const favoriteCount = await tx.tournamentFavorite.count({
        where: { tournamentId: tournament.id },
      });
      return { isFavorited: false, favoriteCount };
    });
  }

  private async resolveTournament(slug: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!tournament) throw new NotFoundException('Tournament not found');
    return tournament;
  }
}
