import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CompetitionAuditAction,
  MatchOutcome,
  MatchStatus,
  NotificationType,
  Prisma,
  RoundFormat,
  RoundStatus,
  TournamentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ApplicationErrorCode } from '../common/errors/application-error-code';
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
import { RoundLifecycleService } from '../brackets/round-lifecycle.service';
import {
  COMPETITION_AUDIT_WRITER,
  CompetitionAuditWriter,
  NOOP_COMPETITION_AUDIT_WRITER,
} from '../common/ports/competition-audit-writer';

const matchResultSelect = {
  id: true,
  matchNumber: true,
  teamAId: true,
  teamBId: true,
  teamA: { select: { name: true } },
  teamB: { select: { name: true } },
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
      name: true,
      format: true,
      settings: true,
      status: true,
      tournamentId: true,
      tournament: { select: { status: true } },
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
    private readonly roundLifecycle: RoundLifecycleService = new RoundLifecycleService(),
    @Inject(COMPETITION_AUDIT_WRITER)
    private readonly audit: CompetitionAuditWriter = NOOP_COMPETITION_AUDIT_WRITER,
  ) {}

  async update(matchId: string, dto: UpdateMatchDto, actorId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockMatch(tx, matchId);
      const match = await this.findResultMatch(tx, matchId);
      this.assertActive(match);
      const changesScore = dto.scoreA !== undefined || dto.scoreB !== undefined;
      const resultTouched =
        dto.scoreA !== undefined ||
        dto.scoreB !== undefined ||
        dto.status !== undefined;
      if (resultTouched) this.assertFinalStandingsMutable(match);
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
          resultChanged,
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
      const lifecycle = resultTouched
        ? await this.roundLifecycle.synchronize(tx, match.round.id)
        : null;
      if (resultTouched && resultChanged) {
        await this.recordResultAudit(tx, match, updated, actorId);
      }
      const revision = updated.updatedAt.toISOString();
      return {
        updated,
        tournamentId: match.round.tournamentId,
        teamIds: [match.teamAId, match.teamBId],
        scheduleChanged,
        tournamentStarted: lifecycle?.tournamentStarted ?? false,
        notifications: [
          ...(scheduleChanged
            ? [
                {
                  type: NotificationType.SCHEDULE_CHANGE,
                  content: 'Match schedule updated',
                  data: scheduleNotificationData(
                    match,
                    match.scheduledAt,
                    toNullableDate(dto.scheduledAt!),
                  ),
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
                  content: 'Match result updated',
                  data: resultNotificationData(match, scoreA, scoreB),
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
    await this.persistNotifications(
      result.tournamentId,
      result.teamIds,
      result.notifications,
    );
    if (result.tournamentStarted) {
      await this.persistTournamentStartedNotification(result.tournamentId);
    }
    return result.updated;
  }

  async putScores(matchId: string, dto: PutMatchScoresDto, actorId?: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockMatch(tx, matchId);
      const match = await this.findResultMatch(tx, matchId);
      this.assertActive(match);
      this.assertFinalStandingsMutable(match);
      const calculated = this.calculateDetailedScores(dto, match);
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
          resultChanged,
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
      const lifecycle = await this.roundLifecycle.synchronize(
        tx,
        match.round.id,
      );
      if (resultChanged) {
        await this.recordResultAudit(tx, match, updated, actorId);
      }
      return {
        updated,
        tournamentId: match.round.tournamentId,
        teamIds: [match.teamAId, match.teamBId],
        tournamentStarted: lifecycle.tournamentStarted,
        notifications:
          resultChanged &&
          (status === MatchStatus.COMPLETED ||
            match.status === MatchStatus.COMPLETED)
            ? [
                {
                  type: NotificationType.SCORE_UPDATE,
                  content: 'Match result updated',
                  data: resultNotificationData(
                    match,
                    calculated.scoreA,
                    calculated.scoreB,
                  ),
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
    await this.persistNotifications(
      result.tournamentId,
      result.teamIds,
      result.notifications,
    );
    if (result.tournamentStarted) {
      await this.persistTournamentStartedNotification(result.tournamentId);
    }
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
    const reference = await tx.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        round: { select: { id: true, tournamentId: true } },
      },
    });
    if (!reference) throw new NotFoundException('Match not found');
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "tournaments" WHERE "id" = ${reference.round.tournamentId} FOR UPDATE`,
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "rounds" WHERE "id" = ${reference.round.id} FOR UPDATE`,
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "matches" WHERE "id" = ${matchId} FOR UPDATE`,
    );
  }

  private async recordResultAudit(
    tx: Tx,
    previous: ResultMatch,
    current: {
      scoreA: number;
      scoreB: number;
      status: MatchStatus;
      winnerTeamId: string | null;
      outcome: MatchOutcome | null;
    },
    actorId?: string,
  ): Promise<void> {
    await this.audit.record(tx, {
      tournamentId: previous.round.tournamentId,
      actorId,
      action:
        previous.status === MatchStatus.COMPLETED
          ? CompetitionAuditAction.MATCH_RESULT_CORRECTED
          : CompetitionAuditAction.MATCH_RESULT_RECORDED,
      roundId: previous.round.id,
      matchId: previous.id,
      details: {
        previous: {
          scoreA: previous.scoreA,
          scoreB: previous.scoreB,
          status: previous.status,
          winnerTeamId: previous.winnerTeamId,
          outcome: previous.outcome,
        },
        current: {
          scoreA: current.scoreA,
          scoreB: current.scoreB,
          status: current.status,
          winnerTeamId: current.winnerTeamId,
          outcome: current.outcome,
        },
      },
    });
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
    teamIds: Array<string | null>,
    notifications: Array<{
      type: NotificationType;
      content: string;
      data: Prisma.InputJsonObject;
      sourceKey: string;
    }>,
  ) {
    try {
      for (const notification of notifications) {
        await this.notifications.createForMatchEvent({
          tournamentId,
          teamIds,
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

  private async persistTournamentStartedNotification(tournamentId: string) {
    try {
      await this.notifications.createForTournamentEvent({
        tournamentId,
        type: NotificationType.TOURNAMENT_STATUS,
        content: 'Tournament started',
        data: {
          kind: 'TOURNAMENT_STATUS',
          previousStatus: TournamentStatus.REGISTRATION,
          status: TournamentStatus.ONGOING,
        },
        sourceKey: `tournament:${tournamentId}:status:${TournamentStatus.REGISTRATION}:${TournamentStatus.ONGOING}`,
      });
    } catch (error) {
      this.logger.error(
        `Round lifecycle committed but notification persistence failed for tournament ${tournamentId}`,
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

  private assertFinalStandingsMutable(match: ResultMatch) {
    const isStandingsFormat =
      match.round.format === RoundFormat.ROUND_ROBIN ||
      match.round.format === RoundFormat.SWISS;
    if (
      isStandingsFormat &&
      match.round.status === RoundStatus.COMPLETED &&
      match.round.tournament.status === TournamentStatus.COMPLETED
    ) {
      throw new ConflictException({
        code: ApplicationErrorCode.FINAL_STANDINGS_RESULT_LOCKED,
        message:
          'Match results are locked after the final standings have been confirmed',
      });
    }
  }

  private calculateDetailedScores(dto: PutMatchScoresDto, match: ResultMatch) {
    return this.applyResultPolicy(() =>
      this.resultPolicy.evaluateDetailedScores(dto.scores, {
        bestOf: match.bestOf,
        teamAId: match.teamAId,
        teamBId: match.teamBId,
        roundFormat: match.round.format,
        roundSettings: match.round.settings,
      }),
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

function resultNotificationData(
  match: ResultMatch,
  scoreA: number,
  scoreB: number,
): Prisma.InputJsonObject {
  return {
    kind: 'MATCH_RESULT',
    matchId: match.id,
    matchNumber: match.matchNumber ?? undefined,
    roundName: match.round.name,
    teamAName: match.teamA?.name ?? 'TBD',
    teamBName: match.teamB?.name ?? 'TBD',
    scoreA,
    scoreB,
  };
}

function scheduleNotificationData(
  match: ResultMatch,
  oldScheduledAt: Date | null,
  newScheduledAt: Date | null,
): Prisma.InputJsonObject {
  return {
    kind: 'MATCH_SCHEDULE',
    matchId: match.id,
    matchNumber: match.matchNumber ?? undefined,
    roundName: match.round.name,
    teamAName: match.teamA?.name ?? 'TBD',
    teamBName: match.teamB?.name ?? 'TBD',
    oldScheduledAt: oldScheduledAt?.toISOString() ?? null,
    newScheduledAt: newScheduledAt?.toISOString() ?? null,
  };
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
