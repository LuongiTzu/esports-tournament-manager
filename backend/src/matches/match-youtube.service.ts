import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, TournamentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  TOURNAMENT_EVENT_PUBLISHER,
  TournamentEventPublisher,
} from '../common/ports/tournament-event-publisher';
import { parseYouTubeUrl } from './domain/youtube-url';
import { UpdateMatchYouTubeDto } from './dto/update-match-youtube.dto';

@Injectable()
export class MatchYouTubeService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TOURNAMENT_EVENT_PUBLISHER)
    private readonly events: TournamentEventPublisher,
  ) {}

  async update(matchId: string, dto: UpdateMatchYouTubeDto) {
    const parsed =
      typeof dto.youtubeUrl === 'string'
        ? parseYouTubeUrl(dto.youtubeUrl)
        : null;
    if (dto.youtubeUrl !== null && !parsed) {
      throw new BadRequestException({
        code: 'INVALID_YOUTUBE_URL',
        message: 'Enter a valid HTTPS YouTube video or live URL',
      });
    }
    const youtubeUrl = parsed?.url ?? null;
    const result = await this.prisma.$transaction(async (tx) => {
      const reference = await tx.match.findUnique({
        where: { id: matchId },
        select: { round: { select: { id: true, tournamentId: true } } },
      });
      if (!reference) throw new NotFoundException('Match not found');
      // Use the same lock order as competition mutations: tournament, round, match.
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "tournaments" WHERE "id" = ${reference.round.tournamentId} FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "rounds" WHERE "id" = ${reference.round.id} FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "matches" WHERE "id" = ${matchId} FOR UPDATE`,
      );
      const match = await tx.match.findUnique({
        where: { id: matchId },
        include: {
          round: { select: { tournament: { select: { status: true } } } },
        },
      });
      if (!match) throw new NotFoundException('Match not found');
      if (
        match.isBye ||
        !match.isActive ||
        match.round.tournament.status === TournamentStatus.CANCELLED
      ) {
        throw new ConflictException({
          code: 'MATCH_YOUTUBE_READ_ONLY',
          message: 'YouTube link cannot be edited for this match',
        });
      }
      const changed = match.youtubeUrl !== youtubeUrl;
      const updated = changed
        ? await tx.match.update({
            where: { id: matchId },
            data: { youtubeUrl },
          })
        : match;
      return { updated, changed, tournamentId: reference.round.tournamentId };
    });
    if (result.changed) {
      this.events.publish({
        tournamentId: result.tournamentId,
        event: 'matchUpdated',
        payload: result.updated,
      });
    }
    return { id: result.updated.id, youtubeUrl: result.updated.youtubeUrl };
  }
}
