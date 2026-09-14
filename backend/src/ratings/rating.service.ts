import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { PaginationQueryDto } from '../common/dto/pagination-query.dto';
import {
  AdminRatingQueryDto,
  ModerateRatingDto,
  SaveRatingDto,
} from './rating.dto';

const publicSelect = {
  id: true,
  score: true,
  content: true,
  createdAt: true,
  updatedAt: true,
  author: { select: { id: true, displayName: true, avatarUrl: true } },
} satisfies Prisma.TournamentRatingSelect;

function pagination(query: PaginationQueryDto) {
  const page = query.page ?? 1,
    limit = Math.min(query.limit ?? 10, 50);
  return { page, limit, skip: (page - 1) * limit };
}

@Injectable()
export class RatingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly filter: ContentFilterService,
  ) {}

  private async tournament(tx: Prisma.TransactionClient, slug: string) {
    const value = await tx.tournament.findUnique({
      where: { slug },
      select: { id: true, status: true, organizerId: true },
    });
    if (!value) throw new NotFoundException('Tournament not found');
    return value;
  }

  private async eligibility(
    tx: Prisma.TransactionClient,
    tournament: { id: string; status: string; organizerId: string },
    user?: AuthenticatedUser,
  ) {
    if (!user) return 'LOGIN_REQUIRED';
    if (!user.emailVerifiedAt) return 'VERIFY_EMAIL';
    if (user.id === tournament.organizerId) return 'ORGANIZER';
    if (tournament.status !== 'COMPLETED') return 'NOT_COMPLETED';
    const team = await tx.team.findFirst({
      where: {
        tournamentId: tournament.id,
        status: 'APPROVED',
        OR: [
          { captainId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
      select: { id: true },
    });
    return team ? 'ALLOWED' : 'NOT_PARTICIPANT';
  }

  list(
    slug: string,
    user: AuthenticatedUser | undefined,
    query: PaginationQueryDto,
  ) {
    return this.prisma.$transaction(
      async (tx) => {
        const tournament = await this.tournament(tx, slug);
        const where = { tournamentId: tournament.id, isHidden: false };
        const { page, limit, skip } = pagination(query);
        const [data, aggregate, mine, reason] = await Promise.all([
          tx.tournamentRating.findMany({
            where,
            select: publicSelect,
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip,
            take: limit,
          }),
          tx.tournamentRating.aggregate({
            where,
            _avg: { score: true },
            _count: true,
          }),
          user
            ? tx.tournamentRating.findUnique({
                where: {
                  tournamentId_authorId: {
                    tournamentId: tournament.id,
                    authorId: user.id,
                  },
                },
                select: {
                  ...publicSelect,
                  isHidden: true,
                  moderationReason: true,
                },
              })
            : null,
          this.eligibility(tx, tournament, user),
        ]);
        return {
          data,
          summary: { average: aggregate._avg.score, count: aggregate._count },
          mine,
          eligibility: {
            reason,
            canCreate: reason === 'ALLOWED' && !mine,
            canEdit: reason === 'ALLOWED' && Boolean(mine),
            canDelete: Boolean(mine && user?.emailVerifiedAt),
          },
          pagination: {
            page,
            limit,
            total: aggregate._count,
            totalPages: Math.ceil(aggregate._count / limit),
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async save(
    slug: string,
    user: AuthenticatedUser,
    dto: SaveRatingDto,
    create: boolean,
  ) {
    const content = this.filter.validate(dto.content ?? '') || null;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "tournaments" WHERE "slug" = ${slug} FOR UPDATE`,
        );
        const tournament = await this.tournament(tx, slug);
        const reason = await this.eligibility(tx, tournament, user);
        if (reason !== 'ALLOWED')
          throw new ForbiddenException({
            message: 'You are not eligible to rate this tournament',
            reason,
          });
        const where = {
          tournamentId_authorId: {
            tournamentId: tournament.id,
            authorId: user.id,
          },
        };
        if (create)
          return tx.tournamentRating.create({
            data: {
              tournamentId: tournament.id,
              authorId: user.id,
              score: dto.score,
              content,
            },
            select: publicSelect,
          });
        // Editing never clears an administrator's moderation decision.
        if (!(await tx.tournamentRating.findUnique({ where })))
          throw new NotFoundException('Rating not found');
        return tx.tournamentRating.update({
          where,
          data: { score: dto.score, content },
          select: publicSelect,
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      )
        throw new ConflictException('You have already rated this tournament');
      throw error;
    }
  }

  async remove(slug: string, userId: string) {
    const tournament = await this.tournament(this.prisma, slug);
    const result = await this.prisma.tournamentRating.deleteMany({
      where: { tournamentId: tournament.id, authorId: userId },
    });
    if (!result.count) throw new NotFoundException('Rating not found');
    return { deleted: true };
  }

  adminList(query: AdminRatingQueryDto) {
    const { page, limit, skip } = pagination(query);
    const where = { isHidden: query.isHidden };
    return this.prisma.$transaction(
      async (tx) => {
        const [data, total] = await Promise.all([
          tx.tournamentRating.findMany({
            where,
            select: {
              ...publicSelect,
              isHidden: true,
              moderationReason: true,
              moderatedAt: true,
              tournament: { select: { id: true, name: true, slug: true } },
            },
            orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
            skip,
            take: limit,
          }),
          tx.tournamentRating.count({ where }),
        ]);
        return {
          data,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead },
    );
  }

  async moderate(id: string, adminId: string, dto: ModerateRatingDto) {
    if (dto.isHidden && !dto.reason?.trim())
      throw new BadRequestException('A reason is required to hide a rating');
    const result = await this.prisma.tournamentRating.updateMany({
      where: { id },
      data: {
        isHidden: dto.isHidden,
        moderationReason: dto.isHidden ? dto.reason!.trim() : null,
        moderatedBy: adminId,
        moderatedAt: new Date(),
      },
    });
    if (!result.count) throw new NotFoundException('Rating not found');
    return { updated: true };
  }
}
