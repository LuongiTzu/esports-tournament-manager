import {
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompetitionAuditAction,
  MatchResultDecision,
  MatchResultReviewStatus,
  MatchStatus,
  Prisma,
  RegistrationStatus,
} from '@prisma/client';
import {
  COMPETITION_AUDIT_WRITER,
  CompetitionAuditWriter,
  NOOP_COMPETITION_AUDIT_WRITER,
} from '../common/ports/competition-audit-writer';
import { PrismaService } from '../prisma/prisma.service';
import {
  ResolveMatchDisputeDto,
  RespondToMatchResultDto,
} from './dto/match-result-review.dto';
import { matchResultReviewSelect } from './match-result-review.select';
import { TournamentResultReviewsQueryDto } from './dto/tournament-result-reviews.dto';

@Injectable()
export class MatchResultReviewService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(COMPETITION_AUDIT_WRITER)
    private readonly audit: CompetitionAuditWriter = NOOP_COMPETITION_AUDIT_WRITER,
  ) {}

  findOne(matchId: string) {
    return this.prisma.matchResultReview.findUnique({
      where: { matchId },
      select: matchResultReviewSelect,
    });
  }

  async findForTournament(
    tournamentId: string,
    query: TournamentResultReviewsQueryDto,
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const scope: Prisma.MatchResultReviewWhereInput = {
      match: { round: { tournamentId } },
    };
    const where: Prisma.MatchResultReviewWhereInput = {
      ...scope,
      status: query.status ?? MatchResultReviewStatus.DISPUTED,
    };
    const [reviews, total, statusGroups] = await Promise.all([
      this.prisma.matchResultReview.findMany({
        where,
        orderBy: [{ updatedAt: 'desc' }, { matchId: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          matchId: true,
          status: true,
          openedAt: true,
          updatedAt: true,
          match: {
            select: {
              matchNumber: true,
              teamA: { select: { id: true, name: true } },
              teamB: { select: { id: true, name: true } },
              round: { select: { id: true, name: true } },
            },
          },
        },
      }),
      this.prisma.matchResultReview.count({ where }),
      this.prisma.matchResultReview.groupBy({
        by: ['status'],
        where: scope,
        _count: { _all: true },
      }),
    ]);
    const counts = Object.fromEntries(
      statusGroups.map((group) => [group.status, group._count._all]),
    ) as Partial<Record<MatchResultReviewStatus, number>>;
    return {
      data: reviews.map((review) => ({
        matchId: review.matchId,
        roundId: review.match.round.id,
        roundName: review.match.round.name,
        matchNumber: review.match.matchNumber,
        teamA: review.match.teamA,
        teamB: review.match.teamB,
        status: review.status,
        openedAt: review.openedAt,
        updatedAt: review.updatedAt,
      })),
      summary: {
        disputed: counts.DISPUTED ?? 0,
        pendingConfirmation: counts.PENDING_CONFIRMATION ?? 0,
        resolved: counts.RESOLVED ?? 0,
        confirmed: counts.CONFIRMED ?? 0,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  respond(matchId: string, userId: string, dto: RespondToMatchResultDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockMatch(tx, matchId);
      const match = await tx.match.findUnique({
        where: { id: matchId },
        select: {
          id: true,
          status: true,
          isActive: true,
          isBye: true,
          teamAId: true,
          teamBId: true,
          teamA: { select: { id: true, captainId: true, status: true } },
          teamB: { select: { id: true, captainId: true, status: true } },
          round: { select: { id: true, tournamentId: true } },
          resultReview: { select: matchResultReviewSelect },
        },
      });
      if (!match) throw new NotFoundException('Match not found');
      if (
        !match.isActive ||
        match.isBye ||
        match.status !== MatchStatus.COMPLETED
      ) {
        throw new ConflictException(
          'Only completed playable matches accept result responses',
        );
      }

      const team = [match.teamA, match.teamB].find(
        (candidate) => candidate?.id === dto.teamId,
      );
      if (!team) {
        throw new ForbiddenException('Team is not assigned to this match');
      }
      if (team.captainId !== userId) {
        throw new ForbiddenException(
          'Only the team captain can respond to the result',
        );
      }
      if (team.status !== RegistrationStatus.APPROVED) {
        throw new ConflictException(
          'Only approved teams can respond to the result',
        );
      }
      if (
        dto.decision === MatchResultDecision.DISPUTED &&
        (!dto.note || dto.note.trim().length < 10)
      ) {
        throw new ConflictException(
          'A dispute must include at least 10 characters of explanation',
        );
      }

      const review =
        match.resultReview ??
        (await tx.matchResultReview.create({
          data: { matchId },
          select: matchResultReviewSelect,
        }));
      if (
        review.status === MatchResultReviewStatus.CONFIRMED ||
        review.status === MatchResultReviewStatus.RESOLVED
      ) {
        throw new ConflictException('The result review is already finalized');
      }
      if (review.responses.some((response) => response.teamId === dto.teamId)) {
        throw new ConflictException(
          'This team has already responded to the result',
        );
      }

      await tx.matchResultResponse.create({
        data: {
          reviewMatchId: matchId,
          teamId: dto.teamId,
          respondedById: userId,
          decision: dto.decision,
          note: dto.note?.trim(),
          evidenceUrls: dto.evidenceUrls ?? [],
        },
      });

      const responses = [
        ...review.responses,
        { teamId: dto.teamId, decision: dto.decision },
      ];
      const assignedTeamIds = [match.teamAId, match.teamBId].filter(
        (teamId): teamId is string => Boolean(teamId),
      );
      const status = responses.some(
        (response) => response.decision === MatchResultDecision.DISPUTED,
      )
        ? MatchResultReviewStatus.DISPUTED
        : assignedTeamIds.every((teamId) =>
              responses.some(
                (response) =>
                  response.teamId === teamId &&
                  response.decision === MatchResultDecision.CONFIRMED,
              ),
            )
          ? MatchResultReviewStatus.CONFIRMED
          : MatchResultReviewStatus.PENDING_CONFIRMATION;

      const updated = await tx.matchResultReview.update({
        where: { matchId },
        data: { status },
        select: matchResultReviewSelect,
      });
      await this.audit.record(tx, {
        tournamentId: match.round.tournamentId,
        actorId: userId,
        action:
          dto.decision === MatchResultDecision.DISPUTED
            ? CompetitionAuditAction.MATCH_RESULT_DISPUTED
            : CompetitionAuditAction.MATCH_RESULT_CONFIRMED,
        roundId: match.round.id,
        matchId,
        details: {
          teamId: dto.teamId,
          decision: dto.decision,
          reviewStatus: status,
          evidenceUrls: dto.evidenceUrls ?? [],
        },
      });
      return updated;
    });
  }

  resolve(matchId: string, actorId: string, dto: ResolveMatchDisputeDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockMatch(tx, matchId);
      const review = await tx.matchResultReview.findUnique({
        where: { matchId },
        select: {
          status: true,
          match: {
            select: {
              round: { select: { id: true, tournamentId: true } },
            },
          },
        },
      });
      if (!review) throw new NotFoundException('Result review not found');
      if (review.status !== MatchResultReviewStatus.DISPUTED) {
        throw new ConflictException('Only a disputed result can be resolved');
      }

      const resolvedAt = new Date();
      const updated = await tx.matchResultReview.update({
        where: { matchId },
        data: {
          status: MatchResultReviewStatus.RESOLVED,
          resolvedAt,
          resolvedById: actorId,
          resolutionNote: dto.resolutionNote.trim(),
        },
        select: matchResultReviewSelect,
      });
      await this.audit.record(tx, {
        tournamentId: review.match.round.tournamentId,
        actorId,
        action: CompetitionAuditAction.MATCH_DISPUTE_RESOLVED,
        roundId: review.match.round.id,
        matchId,
        details: {
          decision: 'UPHOLD_RESULT',
          resolutionNote: dto.resolutionNote.trim(),
          resolvedAt: resolvedAt.toISOString(),
        },
      });
      return updated;
    });
  }

  private async lockMatch(tx: Prisma.TransactionClient, matchId: string) {
    const match = await tx.match.findUnique({
      where: { id: matchId },
      select: { id: true },
    });
    if (!match) throw new NotFoundException('Match not found');
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "matches" WHERE "id" = ${matchId} FOR UPDATE`,
    );
  }
}
