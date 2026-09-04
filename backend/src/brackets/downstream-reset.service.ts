import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompetitionAuditAction,
  MatchStatus,
  Prisma,
  RoundStatus,
  TournamentStatus,
} from '@prisma/client';
import { createHash } from 'crypto';
import { ApplicationErrorCode } from '../common/errors/application-error-code';
import {
  NOOP_TOURNAMENT_EVENT_PUBLISHER,
  TOURNAMENT_EVENT_PUBLISHER,
  TournamentEventPublisher,
} from '../common/ports/tournament-event-publisher';
import { PrismaService } from '../prisma/prisma.service';
import {
  downstreamResetBlockedReason,
  tournamentStatusAfterDownstreamReset,
} from './domain/downstream-reset';
import {
  COMPETITION_AUDIT_WRITER,
  CompetitionAuditWriter,
  NOOP_COMPETITION_AUDIT_WRITER,
} from '../common/ports/competition-audit-writer';

type ResetClient = Pick<
  Prisma.TransactionClient,
  | 'round'
  | 'roundTeam'
  | 'match'
  | 'group'
  | 'team'
  | 'tournament'
  | '$queryRaw'
>;

@Injectable()
export class DownstreamResetService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TOURNAMENT_EVENT_PUBLISHER)
    private readonly events: TournamentEventPublisher = NOOP_TOURNAMENT_EVENT_PUBLISHER,
    @Inject(COMPETITION_AUDIT_WRITER)
    private readonly audit: CompetitionAuditWriter = NOOP_COMPETITION_AUDIT_WRITER,
  ) {}

  async preview(sourceRoundId: string) {
    const plan = await this.loadPlan(this.prisma, sourceRoundId);
    this.assertAvailable(plan);
    return this.publicPlan(plan);
  }

  async reset(
    sourceRoundId: string,
    expectedPreviewToken: string,
    actorId?: string,
  ) {
    const result = await this.prisma.$transaction(async (tx) => {
      const reference = await tx.round.findUnique({
        where: { id: sourceRoundId },
        select: { id: true, tournamentId: true, orderIndex: true },
      });
      if (!reference) throw new NotFoundException('Không tìm thấy vòng đấu');

      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "tournaments" WHERE "id" = ${reference.tournamentId} FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "rounds" WHERE "id" = ${sourceRoundId} FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "rounds" WHERE "tournament_id" = ${reference.tournamentId} AND "order_index" > ${reference.orderIndex} ORDER BY "order_index", "id" FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT m."id" FROM "matches" m INNER JOIN "rounds" r ON r."id" = m."round_id" WHERE r."tournament_id" = ${reference.tournamentId} AND r."order_index" > ${reference.orderIndex} ORDER BY m."id" FOR UPDATE`,
      );

      const plan = await this.loadPlan(tx, sourceRoundId);
      this.assertAvailable(plan);
      if (plan.previewToken !== expectedPreviewToken) {
        throw new ConflictException({
          code: ApplicationErrorCode.DOWNSTREAM_RESET_PREVIEW_STALE,
          message:
            'Downstream competition data changed after the reset preview',
        });
      }

      const downstreamRoundIds = plan.downstreamRounds.map((round) => round.id);
      await tx.roundTeam.deleteMany({
        where: { roundId: { in: downstreamRoundIds } },
      });
      await tx.match.deleteMany({
        where: { roundId: { in: downstreamRoundIds } },
      });
      await tx.group.deleteMany({
        where: { roundId: { in: downstreamRoundIds } },
      });
      await tx.round.updateMany({
        where: { id: { in: downstreamRoundIds } },
        data: { status: RoundStatus.UPCOMING },
      });
      await tx.team.updateMany({
        where: { tournamentId: plan.tournament.id, finalRank: { not: null } },
        data: { finalRank: null },
      });
      const tournamentStatus = tournamentStatusAfterDownstreamReset(
        plan.tournament.status,
      );
      if (tournamentStatus !== plan.tournament.status) {
        await tx.tournament.update({
          where: { id: plan.tournament.id },
          data: { status: tournamentStatus },
        });
      }

      await this.audit.record(tx, {
        tournamentId: plan.tournament.id,
        actorId,
        action: CompetitionAuditAction.DOWNSTREAM_RESET,
        roundId: sourceRoundId,
        details: {
          sourceRoundName: plan.sourceRound.name,
          downstreamRoundIds,
          impact: plan.impact,
          previousTournamentStatus: plan.tournament.status,
          tournamentStatus,
        },
      });

      return {
        ...this.publicPlan(plan),
        tournamentId: plan.tournament.id,
        tournamentStatus,
      };
    });

    const { tournamentId, ...payload } = result;
    this.events.publish({
      tournamentId,
      event: 'standingsUpdated',
      payload: { sourceRoundId, downstreamReset: true },
    });
    return payload;
  }

  private async loadPlan(client: ResetClient, sourceRoundId: string) {
    const sourceRound = await client.round.findUnique({
      where: { id: sourceRoundId },
      select: {
        id: true,
        name: true,
        orderIndex: true,
        status: true,
        tournamentId: true,
        tournament: { select: { id: true, status: true, updatedAt: true } },
      },
    });
    if (!sourceRound) throw new NotFoundException('Không tìm thấy vòng đấu');

    const [downstreamRounds, finalRankedTeamCount] = await Promise.all([
      client.round.findMany({
        where: {
          tournamentId: sourceRound.tournamentId,
          orderIndex: { gt: sourceRound.orderIndex },
        },
        orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          name: true,
          orderIndex: true,
          status: true,
          updatedAt: true,
          matches: {
            orderBy: { id: 'asc' },
            select: {
              id: true,
              status: true,
              scoreA: true,
              scoreB: true,
              winnerTeamId: true,
              playedAt: true,
              updatedAt: true,
              _count: { select: { scores: true } },
            },
          },
          groups: {
            orderBy: { id: 'asc' },
            select: { id: true },
          },
          participants: {
            orderBy: [{ seed: 'asc' }, { teamId: 'asc' }],
            select: {
              teamId: true,
              advancedFromRoundId: true,
              seed: true,
              createdAt: true,
            },
          },
        },
      }),
      client.team.count({
        where: {
          tournamentId: sourceRound.tournamentId,
          finalRank: { not: null },
        },
      }),
    ]);

    const matches = downstreamRounds.flatMap((round) => round.matches);
    const impact = {
      roundCount: downstreamRounds.length,
      matchCount: matches.length,
      completedMatchCount: matches.filter(
        (match) => match.status === MatchStatus.COMPLETED,
      ).length,
      progressedMatchCount: matches.filter(hasMatchProgress).length,
      groupCount: downstreamRounds.reduce(
        (count, round) => count + round.groups.length,
        0,
      ),
      participantAssignmentCount: downstreamRounds.reduce(
        (count, round) => count + round.participants.length,
        0,
      ),
      finalRankedTeamCount,
    };
    const resettableItemCount =
      impact.matchCount +
      impact.groupCount +
      impact.participantAssignmentCount +
      impact.finalRankedTeamCount +
      downstreamRounds.filter((round) => round.status !== RoundStatus.UPCOMING)
        .length +
      (sourceRound.tournament.status === TournamentStatus.COMPLETED ? 1 : 0);
    const previewToken = createHash('sha256')
      .update(
        JSON.stringify({
          sourceRound: {
            id: sourceRound.id,
            orderIndex: sourceRound.orderIndex,
            status: sourceRound.status,
          },
          tournament: sourceRound.tournament,
          downstreamRounds,
          finalRankedTeamCount,
        }),
      )
      .digest('hex');

    return {
      sourceRound,
      tournament: sourceRound.tournament,
      downstreamRounds,
      impact,
      resettableItemCount,
      previewToken,
    };
  }

  private assertAvailable(plan: Awaited<ReturnType<typeof this.loadPlan>>) {
    const reason = downstreamResetBlockedReason({
      tournamentStatus: plan.tournament.status,
      downstreamRoundCount: plan.downstreamRounds.length,
      resettableItemCount: plan.resettableItemCount,
    });
    if (!reason) return;
    throw new ConflictException({
      code:
        reason === 'TOURNAMENT_LOCKED'
          ? ApplicationErrorCode.DOWNSTREAM_RESET_TOURNAMENT_LOCKED
          : ApplicationErrorCode.DOWNSTREAM_RESET_NOT_AVAILABLE,
      message:
        reason === 'TOURNAMENT_LOCKED'
          ? 'The Tournament does not allow downstream reset'
          : reason === 'NO_DOWNSTREAM_ROUNDS'
            ? 'The selected Round has no downstream Rounds'
            : 'There is no downstream competition data to reset',
      details: { reason },
    });
  }

  private publicPlan(plan: Awaited<ReturnType<typeof this.loadPlan>>) {
    return {
      previewToken: plan.previewToken,
      sourceRound: {
        id: plan.sourceRound.id,
        name: plan.sourceRound.name,
        orderIndex: plan.sourceRound.orderIndex,
        status: plan.sourceRound.status,
      },
      downstreamRounds: plan.downstreamRounds.map((round) => ({
        id: round.id,
        name: round.name,
        orderIndex: round.orderIndex,
        status: round.status,
        matchCount: round.matches.length,
        groupCount: round.groups.length,
        participantAssignmentCount: round.participants.length,
        progressedMatchCount: round.matches.filter(hasMatchProgress).length,
      })),
      impact: plan.impact,
    };
  }
}

function hasMatchProgress(match: {
  status: MatchStatus;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
  playedAt: Date | null;
  _count: { scores: number };
}): boolean {
  return (
    match.status !== MatchStatus.PENDING ||
    match.scoreA !== 0 ||
    match.scoreB !== 0 ||
    match.winnerTeamId !== null ||
    match.playedAt !== null ||
    match._count.scores > 0
  );
}
