import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { NotificationType, Prisma } from '@prisma/client';
import { createHash } from 'crypto';
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
import { BulkScheduleDto, CreateManualMatchDto } from './dto/match.dto';
import {
  MatchResultPolicy,
  MatchResultRuleError,
} from './domain/match-result.policy';

@Injectable()
export class MatchSchedulingService {
  private readonly logger = new Logger(MatchSchedulingService.name);
  constructor(
    private readonly prisma: PrismaService,
    @Inject(TOURNAMENT_EVENT_PUBLISHER)
    private readonly events: TournamentEventPublisher = NOOP_TOURNAMENT_EVENT_PUBLISHER,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notifications: NotificationPublisher = NOOP_NOTIFICATION_PUBLISHER,
    private readonly resultPolicy: MatchResultPolicy = new MatchResultPolicy(),
  ) {}

  async bulkSchedule(dto: BulkScheduleDto) {
    const ids = dto.matches.map((item) => item.matchId);
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Match IDs must be unique');
    }
    const result = await this.prisma.$transaction(async (tx) => {
      const matches = await tx.match.findMany({
        where: { id: { in: ids } },
        select: {
          id: true,
          scheduledAt: true,
          updatedAt: true,
          round: { select: { tournamentId: true } },
        },
      });
      if (matches.length !== ids.length) {
        throw new NotFoundException('One or more matches were not found');
      }
      if (
        new Set(matches.map((match) => match.round.tournamentId)).size !== 1
      ) {
        throw new BadRequestException(
          'All matches must belong to the same tournament',
        );
      }
      const revisions: Array<{ id: string; updatedAt: Date }> = [];
      let changedCount = 0;
      for (const item of dto.matches) {
        const match = matches.find(
          (candidate) => candidate.id === item.matchId,
        )!;
        const scheduledAt = toNullableDate(item.scheduledAt);
        if (sameDate(match.scheduledAt, scheduledAt)) {
          revisions.push({ id: match.id, updatedAt: match.updatedAt });
          continue;
        }
        const updated = await tx.match.update({
          where: { id: item.matchId },
          data: { scheduledAt },
          select: { id: true, updatedAt: true },
        });
        revisions.push(updated);
        changedCount++;
      }
      return {
        tournamentId: matches[0].round.tournamentId,
        changedCount,
        sourceKey: bulkScheduleSourceKey(revisions),
        updatedCount: ids.length,
        matchIds: ids,
      };
    });
    const { tournamentId, changedCount, sourceKey, ...payload } = result;
    if (changedCount > 0) {
      this.events.publish({
        tournamentId,
        event: 'scheduleUpdated',
        payload,
      });
    }
    if (changedCount > 0) {
      await this.persistNotifications(tournamentId, [
        {
          type: NotificationType.SCHEDULE_CHANGE,
          content: `Lịch thi đấu đã được cập nhật cho ${ids.length} trận`,
          sourceKey,
        },
      ]);
    }
    return payload;
  }

  createManual(roundId: string, dto: CreateManualMatchDto) {
    return this.prisma.$transaction(async (tx) => {
      const round = await tx.round.findUnique({
        where: { id: roundId },
        select: { id: true, tournamentId: true, bestOf: true },
      });
      if (!round) throw new NotFoundException('Round not found');
      if (dto.teamAId === dto.teamBId) {
        throw new BadRequestException('A team cannot play itself');
      }
      const teamIds = [dto.teamAId, dto.teamBId].filter(
        (id): id is string => id !== undefined,
      );
      const teams = await tx.team.findMany({
        where: { id: { in: teamIds }, tournamentId: round.tournamentId },
        select: { id: true },
      });
      if (teams.length !== new Set(teamIds).size) {
        throw new BadRequestException(
          'Every team must belong to the round tournament',
        );
      }
      if (dto.groupId) {
        const group = await tx.group.findFirst({
          where: { id: dto.groupId, roundId },
          select: { id: true },
        });
        if (!group) throw new BadRequestException('Group must belong to round');
      }
      const bestOf = dto.bestOf ?? round.bestOf;
      this.validateBestOf(bestOf);
      return tx.match.create({
        data: {
          roundId,
          groupId: dto.groupId,
          teamAId: dto.teamAId,
          teamBId: dto.teamBId,
          bestOf,
          scheduledAt: dto.scheduledAt ? new Date(dto.scheduledAt) : undefined,
          discordLink: dto.discordLink,
        },
      });
    });
  }

  private validateBestOf(bestOf: number) {
    try {
      this.resultPolicy.assertBestOf(bestOf);
    } catch (error) {
      if (error instanceof MatchResultRuleError) {
        throw new BadRequestException(error.message);
      }
      throw error;
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
}

function toNullableDate(value: string | null): Date | null {
  return value === null ? null : new Date(value);
}
function sameDate(left: Date | null, right: Date | null): boolean {
  return left?.getTime() === right?.getTime();
}
function bulkScheduleSourceKey(
  revisions: Array<{ id: string; updatedAt: Date }>,
): string {
  const value = revisions
    .sort((left, right) => left.id.localeCompare(right.id))
    .map((revision) => `${revision.id}:${revision.updatedAt.toISOString()}`)
    .join('|');
  return `bulk-schedule:${createHash('sha256').update(value).digest('hex')}`;
}
