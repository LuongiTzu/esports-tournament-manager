import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MatchOutcome,
  MatchStatus,
  NotificationType,
  Prisma,
  RoundFormat,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  NOTIFICATION_PUBLISHER,
  NOOP_NOTIFICATION_PUBLISHER,
  NotificationPublisher,
} from '../common/ports/notification-publisher';
import {
  NOOP_TOURNAMENT_EVENT_PUBLISHER,
  TOURNAMENT_EVENT_PUBLISHER,
  TournamentEventPublisher,
} from '../common/ports/tournament-event-publisher';
import { PutMatchScoresDto, UpdateMatchDto } from './dto/match.dto';
import {
  MatchResultPolicy,
  MatchResultRuleError,
} from './domain/match-result.policy';
import { CompetitionProgressionService } from './competition-progression.service';

const matchResultSelect = {
  id: true,
  teamAId: true,
  teamBId: true,
  scoreA: true,
  scoreB: true,
  status: true,
  isActive: true,
  activationCondition: true,
  bracketType: true,
  bestOf: true,
  winnerTeamId: true,
  outcome: true,
  playedAt: true,
  scheduledAt: true,
  updatedAt: true,
  nextMatchId: true,
  nextMatchSlot: true,
  loserNextMatchId: true,
  loserNextMatchSlot: true,
  round: {
    select: {
      id: true,
      format: true,
      settings: true,
      tournamentId: true,
    },
  },
  scores: {
    select: { setNumber: true, teamAScore: true, teamBScore: true },
    orderBy: { setNumber: 'asc' as const },
  },
  _count: { select: { scores: true } },
} satisfies Prisma.MatchSelect;

export type ResultMatch = Prisma.MatchGetPayload<{
  select: typeof matchResultSelect;
}>;
export type MatchTransactionClient = Prisma.TransactionClient;
type Tx = MatchTransactionClient;

@Injectable()
export class MatchResultService {
  private readonly logger = new Logger(MatchResultService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(TOURNAMENT_EVENT_PUBLISHER)
    private readonly events: TournamentEventPublisher = NOOP_TOURNAMENT_EVENT_PUBLISHER,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notifications: NotificationPublisher = NOOP_NOTIFICATION_PUBLISHER,
    private readonly resultPolicy: MatchResultPolicy = new MatchResultPolicy(),
    private readonly progression: CompetitionProgressionService = new CompetitionProgressionService(),
  ) {}

  async update(matchId: string, dto: UpdateMatchDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockMatch(tx, matchId);
      const match = await this.findResultMatch(tx, matchId);
      this.assertActive(match);
      const changesScore = dto.scoreA !== undefined || dto.scoreB !== undefined;
      if (changesScore && match._count.scores > 0) {
        throw new ConflictException(
          'Match has per-game scores; use PUT /matches/:id/scores',
        );
      }

      const scoreA = dto.scoreA ?? match.scoreA;
      const scoreB = dto.scoreB ?? match.scoreB;
      const status = dto.status ?? match.status;
      const outcome = this.validateResult(match, scoreA, scoreB, status);
      const winnerTeamId = outcome.winnerTeamId;
      const scheduleChanged =
        dto.scheduledAt !== undefined &&
        !sameDate(match.scheduledAt, toNullableDate(dto.scheduledAt));
      const resultTouched =
        dto.scoreA !== undefined ||
        dto.scoreB !== undefined ||
        dto.status !== undefined;
      const resultChanged =
        scoreA !== match.scoreA ||
        scoreB !== match.scoreB ||
        status !== match.status ||
        winnerTeamId !== match.winnerTeamId ||
        outcome.outcome !== match.outcome;

      if (match.status === MatchStatus.COMPLETED) {
        await this.progression.rollbackPreviousAdvancement(
          tx,
          match,
          winnerTeamId,
          status,
        );
      }

      const updated = await tx.match.update({
        where: { id: matchId },
        data: {
          scoreA: dto.scoreA,
          scoreB: dto.scoreB,
          scheduledAt:
            dto.scheduledAt === undefined
              ? undefined
              : dto.scheduledAt === null
                ? null
                : new Date(dto.scheduledAt),
          discordLink: dto.discordLink,
          status: dto.status,
          winnerTeamId,
          outcome: outcome.outcome,
          playedAt:
            status === MatchStatus.COMPLETED
              ? (match.playedAt ?? new Date())
              : null,
        },
      });

      if (status === MatchStatus.COMPLETED && winnerTeamId) {
        await this.progression.advanceResult(tx, match, winnerTeamId);
        await this.progression.completeEliminationIfReady(tx, match);
      }
      const revision = updated.updatedAt.toISOString();
      return {
        updated,
        tournamentId: match.round.tournamentId,
        scheduleChanged,
        notifications: [
          ...(scheduleChanged
            ? [
                {
                  type: NotificationType.SCHEDULE_CHANGE,
                  content: `Lịch thi đấu của trận ${matchId} đã được cập nhật`,
                  sourceKey: `match:${matchId}:schedule:${revision}`,
                },
              ]
            : []),
          ...(resultTouched &&
          resultChanged &&
          (status === MatchStatus.COMPLETED ||
            match.status === MatchStatus.COMPLETED)
            ? [
                {
                  type: NotificationType.SCORE_UPDATE,
                  content: `Kết quả trận ${matchId} đã được cập nhật`,
                  sourceKey: `match:${matchId}:result:${revision}`,
                },
              ]
            : []),
        ],
      };
    });
    this.publishMatchEvents(
      matchId,
      result.tournamentId,
      result.updated,
      result.scheduleChanged,
    );
    await this.persistNotifications(result.tournamentId, result.notifications);
    return result.updated;
  }

  async putScores(matchId: string, dto: PutMatchScoresDto) {
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockMatch(tx, matchId);
      const match = await this.findResultMatch(tx, matchId);
      this.assertActive(match);
      const calculated = this.calculateSeries(dto, match.bestOf);
      const status = calculated.completed
        ? MatchStatus.COMPLETED
        : MatchStatus.ONGOING;
      const outcome = this.validateResult(
        match,
        calculated.scoreA,
        calculated.scoreB,
        status,
      );
      const winnerTeamId = outcome.winnerTeamId;
      const resultChanged =
        calculated.scoreA !== match.scoreA ||
        calculated.scoreB !== match.scoreB ||
        status !== match.status ||
        winnerTeamId !== match.winnerTeamId ||
        outcome.outcome !== match.outcome ||
        !sameScores(match.scores, dto.scores);

      if (match.status === MatchStatus.COMPLETED) {
        await this.progression.rollbackPreviousAdvancement(
          tx,
          match,
          winnerTeamId,
          status,
        );
      }

      await tx.matchScore.deleteMany({ where: { matchId } });
      await tx.matchScore.createMany({
        data: dto.scores.map((score) => ({ matchId, ...score })),
      });
      const updated = await tx.match.update({
        where: { id: matchId },
        data: {
          scoreA: calculated.scoreA,
          scoreB: calculated.scoreB,
          status,
          winnerTeamId,
          outcome: outcome.outcome,
          playedAt:
            status === MatchStatus.COMPLETED
              ? (match.playedAt ?? new Date())
              : null,
        },
        include: { scores: { orderBy: { setNumber: 'asc' } } },
      });

      if (status === MatchStatus.COMPLETED && winnerTeamId) {
        await this.progression.advanceResult(tx, match, winnerTeamId);
        await this.progression.completeEliminationIfReady(tx, match);
      }
      return {
        updated,
        tournamentId: match.round.tournamentId,
        notifications:
          resultChanged &&
          (status === MatchStatus.COMPLETED ||
            match.status === MatchStatus.COMPLETED)
            ? [
                {
                  type: NotificationType.SCORE_UPDATE,
                  content: `Kết quả trận ${matchId} đã được cập nhật`,
                  sourceKey: `match:${matchId}:result:${updated.updatedAt.toISOString()}`,
                },
              ]
            : [],
      };
    });
    this.publishMatchEvents(
      matchId,
      result.tournamentId,
      result.updated,
      false,
    );
    await this.persistNotifications(result.tournamentId, result.notifications);
    return result.updated;
  }

  private async findResultMatch(tx: Tx, matchId: string) {
    const match = await tx.match.findUnique({
      where: { id: matchId },
      select: matchResultSelect,
    });
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  private async lockMatch(tx: Tx, matchId: string): Promise<void> {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "matches" WHERE "id" = ${matchId} FOR UPDATE`,
    );
  }

  private publishMatchEvents(
    matchId: string,
    tournamentId: string,
    payload: unknown,
    scheduleChanged: boolean,
  ) {
    this.events.publish({
      tournamentId,
      event: 'matchUpdated',
      payload,
    });
    this.events.publish({
      tournamentId,
      event: 'standingsUpdated',
      payload: { matchId },
    });
    if (scheduleChanged) {
      this.events.publish({
        tournamentId,
        event: 'scheduleUpdated',
        payload: { matchId },
      });
    }
  }

  private async persistNotifications(
    tournamentId: string,
    notifications: Array<{
      type: NotificationType;
      content: string;
      sourceKey: string;
    }>,
  ) {
    try {
      for (const notification of notifications) {
        await this.notifications.createForTournamentEvent({
          tournamentId,
          ...notification,
        });
      }
    } catch (error) {
      this.logger.error(
        `Match update committed but notification persistence failed for tournament ${tournamentId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }

  private validateResult(
    match: ResultMatch,
    scoreA: number,
    scoreB: number,
    status: MatchStatus,
  ): { winnerTeamId: string | null; outcome: MatchOutcome | null } {
    return this.applyResultPolicy(() =>
      this.resultPolicy.evaluateAggregate(
        {
          bestOf: match.bestOf,
          teamAId: match.teamAId,
          teamBId: match.teamBId,
          roundFormat: match.round.format,
          roundSettings: match.round.settings,
        },
        scoreA,
        scoreB,
        status,
      ),
    );
  }

  private assertActive(match: ResultMatch) {
    if (match.isActive === false) {
      throw new ConflictException('Match is not active');
    }
  }

  private calculateSeries(dto: PutMatchScoresDto, bestOf: number) {
    return this.applyResultPolicy(() =>
      this.resultPolicy.evaluateSeries(dto.scores, bestOf),
    );
  }

  private validateBestOf(bestOf: number) {
    this.applyResultPolicy(() => this.resultPolicy.assertBestOf(bestOf));
  }

  private applyResultPolicy<T>(evaluate: () => T): T {
    try {
      return evaluate();
    } catch (error) {
      if (error instanceof MatchResultRuleError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }
}

function toNullableDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}

function sameDate(left: Date | null, right: Date | null): boolean {
  return left?.getTime() === right?.getTime();
}

function sameScores(
  left: Array<{ setNumber: number; teamAScore: number; teamBScore: number }>,
  right: Array<{ setNumber: number; teamAScore: number; teamBScore: number }>,
): boolean {
  if (left.length !== right.length) return false;
  const sortedRight = [...right].sort(
    (first, second) => first.setNumber - second.setNumber,
  );
  return left.every((score, index) => {
    const candidate = sortedRight[index];
    return (
      score.setNumber === candidate.setNumber &&
      score.teamAScore === candidate.teamAScore &&
      score.teamBScore === candidate.teamBScore
    );
  });
}
