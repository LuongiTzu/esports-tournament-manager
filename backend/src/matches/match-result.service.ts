import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  MatchActivationCondition,
  MatchOutcome,
  MatchSlot,
  MatchStatus,
  NotificationType,
  Prisma,
  RoundFormat,
  RoundStatus,
  TournamentStatus,
} from '@prisma/client';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentEventsService } from '../tournaments/tournament-events.service';
import { PutMatchScoresDto, UpdateMatchDto } from './dto/match.dto';
import {
  MatchResultPolicy,
  MatchResultRuleError,
} from './domain/match-result.policy';

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

type ResultMatch = Prisma.MatchGetPayload<{ select: typeof matchResultSelect }>;
type Tx = Prisma.TransactionClient;

@Injectable()
export class MatchResultService {
  private readonly logger = new Logger(MatchResultService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly events?: TournamentEventsService,
    @Optional() private readonly notifications?: NotificationService,
    private readonly resultPolicy: MatchResultPolicy = new MatchResultPolicy(),
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
        await this.rollbackPreviousAdvancement(tx, match, winnerTeamId, status);
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
        await this.advanceResult(tx, match, winnerTeamId);
        await this.completeEliminationIfReady(tx, match);
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
        await this.rollbackPreviousAdvancement(tx, match, winnerTeamId, status);
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
        await this.advanceResult(tx, match, winnerTeamId);
        await this.completeEliminationIfReady(tx, match);
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
    if (!this.events) return;
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
    if (!this.notifications) return;
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

  private async rollbackPreviousAdvancement(
    tx: Tx,
    match: ResultMatch,
    newWinnerTeamId: string | null,
    newStatus: MatchStatus,
  ) {
    if (
      newStatus === MatchStatus.COMPLETED &&
      newWinnerTeamId === match.winnerTeamId
    ) {
      return;
    }
    const oldWinner = match.winnerTeamId;
    const oldLoser =
      oldWinner === match.teamAId ? match.teamBId : match.teamAId;
    if (await this.rollbackConditionalReset(tx, match)) {
      await this.rollbackEliminationCompletion(tx, match, oldWinner);
      return;
    }
    const routes = [
      { id: match.nextMatchId, slot: match.nextMatchSlot, teamId: oldWinner },
      {
        id: match.loserNextMatchId,
        slot: match.loserNextMatchSlot,
        teamId: oldLoser,
      },
    ].filter(
      (route): route is { id: string; slot: MatchSlot; teamId: string } =>
        Boolean(route.id && route.slot && route.teamId),
    );
    const downstream = await Promise.all(
      [...new Set(routes.map((route) => route.id))].map((id) =>
        tx.match.findUnique({
          where: { id },
          select: { id: true, status: true, teamAId: true, teamBId: true },
        }),
      ),
    );
    if (downstream.some((item) => item?.status === MatchStatus.COMPLETED)) {
      throw new ConflictException(
        'Downstream match is completed; reset it before changing this result',
      );
    }
    for (const route of routes) {
      const target = downstream.find((item) => item?.id === route.id)!;
      const field = route.slot === MatchSlot.A ? 'teamAId' : 'teamBId';
      if (target[field] !== route.teamId) {
        throw new ConflictException(
          'Downstream slot no longer contains the previously advanced team',
        );
      }
      await tx.match.update({
        where: { id: route.id },
        data: { [field]: null },
      });
      target[field] = null;
    }
    await this.rollbackEliminationCompletion(tx, match, oldWinner);
  }

  private async advanceResult(
    tx: Tx,
    match: ResultMatch,
    winnerTeamId: string,
  ) {
    const loserTeamId =
      winnerTeamId === match.teamAId ? match.teamBId : match.teamAId;
    if (
      await this.processConditionalReset(tx, match, winnerTeamId, loserTeamId)
    ) {
      return;
    }
    await this.placeTeam(
      tx,
      match.nextMatchId,
      match.nextMatchSlot,
      winnerTeamId,
    );
    await this.placeTeam(
      tx,
      match.loserNextMatchId,
      match.loserNextMatchSlot,
      loserTeamId,
    );
  }

  private async processConditionalReset(
    tx: Tx,
    match: ResultMatch,
    winnerTeamId: string,
    loserTeamId: string | null,
  ): Promise<boolean> {
    if (!match.nextMatchId || match.nextMatchId !== match.loserNextMatchId) {
      return false;
    }
    const reset = await tx.match.findUnique({
      where: { id: match.nextMatchId },
      select: {
        id: true,
        teamAId: true,
        teamBId: true,
        status: true,
        isActive: true,
        activationCondition: true,
      },
    });
    if (
      !reset ||
      reset.activationCondition !==
        MatchActivationCondition.LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL
    ) {
      return false;
    }
    if (!loserTeamId) {
      throw new ConflictException('Grand Final loser is missing');
    }

    // The generator always places the Winner Bracket champion in Grand Final
    // slot A and the Loser Bracket champion in slot B.
    if (winnerTeamId !== match.teamBId) {
      return true;
    }

    if (reset.status === MatchStatus.COMPLETED) {
      if (
        reset.isActive &&
        reset.teamAId === winnerTeamId &&
        reset.teamBId === loserTeamId
      ) {
        return true;
      }
      throw new ConflictException('Grand Final Reset is already completed');
    }
    if (
      (reset.teamAId !== null && reset.teamAId !== winnerTeamId) ||
      (reset.teamBId !== null && reset.teamBId !== loserTeamId)
    ) {
      throw new ConflictException(
        'Grand Final Reset slots are already occupied',
      );
    }
    if (
      !reset.isActive ||
      reset.teamAId !== winnerTeamId ||
      reset.teamBId !== loserTeamId
    ) {
      await tx.match.update({
        where: { id: reset.id },
        data: {
          isActive: true,
          teamAId: winnerTeamId,
          teamBId: loserTeamId,
        },
      });
    }
    return true;
  }

  private async rollbackConditionalReset(
    tx: Tx,
    match: ResultMatch,
  ): Promise<boolean> {
    if (!match.nextMatchId || match.nextMatchId !== match.loserNextMatchId) {
      return false;
    }
    const reset = await tx.match.findUnique({
      where: { id: match.nextMatchId },
      select: {
        id: true,
        status: true,
        scoreA: true,
        scoreB: true,
        winnerTeamId: true,
        playedAt: true,
        activationCondition: true,
        _count: { select: { scores: true } },
      },
    });
    if (
      !reset ||
      reset.activationCondition !==
        MatchActivationCondition.LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL
    ) {
      return false;
    }
    if (
      reset.status !== MatchStatus.PENDING ||
      reset.scoreA !== 0 ||
      reset.scoreB !== 0 ||
      reset.winnerTeamId !== null ||
      reset.playedAt !== null ||
      reset._count.scores > 0
    ) {
      throw new ConflictException(
        'Grand Final Reset has started; reset it before changing the Grand Final',
      );
    }
    await tx.match.update({
      where: { id: reset.id },
      data: { isActive: false, teamAId: null, teamBId: null },
    });
    return true;
  }

  private async completeEliminationIfReady(tx: Tx, match: ResultMatch) {
    if (
      match.round.format !== RoundFormat.PLAYOFF &&
      match.round.format !== RoundFormat.DOUBLE_ELIM
    ) {
      return;
    }
    const matches = await tx.match.findMany({
      where: { roundId: match.round.id },
      select: {
        status: true,
        isActive: true,
        bracketType: true,
        bracketRound: true,
        matchNumber: true,
        winnerTeamId: true,
      },
    });
    const required = matches.filter((candidate) => candidate.isActive);
    if (
      required.length === 0 ||
      required.some((candidate) => candidate.status !== MatchStatus.COMPLETED)
    ) {
      return;
    }
    const championship = required
      .filter(
        (candidate) =>
          candidate.bracketType === null &&
          candidate.matchNumber === 1 &&
          candidate.winnerTeamId !== null,
      )
      .sort(
        (left, right) => (right.bracketRound ?? 0) - (left.bracketRound ?? 0),
      )[0];
    if (!championship?.winnerTeamId) return;

    await tx.round.update({
      where: { id: match.round.id },
      data: { status: RoundStatus.COMPLETED },
    });
    const winnerTeamId = championship.winnerTeamId;
    await tx.team.updateMany({
      where: {
        tournamentId: match.round.tournamentId,
        finalRank: 1,
        id: { not: winnerTeamId },
      },
      data: { finalRank: null },
    });
    await tx.team.update({
      where: { id: winnerTeamId },
      data: { finalRank: 1 },
    });
    await tx.round.update({
      where: { id: match.round.id },
      data: { status: RoundStatus.COMPLETED },
    });
    await tx.tournament.update({
      where: { id: match.round.tournamentId },
      data: { status: TournamentStatus.COMPLETED },
    });
  }

  private async rollbackEliminationCompletion(
    tx: Tx,
    match: ResultMatch,
    oldWinnerTeamId: string | null,
  ) {
    if (
      !oldWinnerTeamId ||
      (match.round.format !== RoundFormat.PLAYOFF &&
        match.round.format !== RoundFormat.DOUBLE_ELIM)
    )
      return;
    await tx.team.updateMany({
      where: { id: oldWinnerTeamId, finalRank: 1 },
      data: { finalRank: null },
    });
    await tx.round.update({
      where: { id: match.round.id },
      data: { status: RoundStatus.ONGOING },
    });
    await tx.tournament.update({
      where: { id: match.round.tournamentId },
      data: { status: TournamentStatus.ONGOING },
    });
  }

  private async placeTeam(
    tx: Tx,
    targetId: string | null,
    slot: MatchSlot | null,
    teamId: string | null,
  ) {
    if (!targetId && !slot) return;
    if (!targetId || !slot || !teamId) {
      throw new ConflictException('Bracket progression link is incomplete');
    }
    const target = await tx.match.findUnique({
      where: { id: targetId },
      select: {
        teamAId: true,
        teamBId: true,
        status: true,
        isBye: true,
        nextMatchId: true,
        nextMatchSlot: true,
      },
    });
    if (!target) throw new ConflictException('Downstream match not found');
    const field = slot === MatchSlot.A ? 'teamAId' : 'teamBId';
    if (target[field] !== null && target[field] !== teamId) {
      throw new ConflictException(
        'Downstream bracket slot is already occupied',
      );
    }
    await tx.match.update({
      where: { id: targetId },
      data: {
        [field]: teamId,
        ...(target.isBye && target.status !== MatchStatus.COMPLETED
          ? {
              status: MatchStatus.COMPLETED,
              scoreA: field === 'teamAId' ? 1 : 0,
              scoreB: field === 'teamBId' ? 1 : 0,
              winnerTeamId: teamId,
              outcome:
                field === 'teamAId' ? MatchOutcome.TEAM_A : MatchOutcome.TEAM_B,
            }
          : {}),
      },
    });
    if (target.isBye && target.status !== MatchStatus.COMPLETED) {
      await this.placeTeam(
        tx,
        target.nextMatchId,
        target.nextMatchSlot,
        teamId,
      );
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
