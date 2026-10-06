import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { MyMatchesQueryDto } from './dto/my-matches-query.dto';
import { MATCH_CHECK_IN_WINDOW_MINUTES } from './domain/match-check-in.policy';

export function myMatchFilters(
  query: MyMatchesQueryDto,
  userTeamIds: string[],
  captainTeamIds: string[],
  now: Date,
): Prisma.MatchWhereInput[] {
  const filters: Prisma.MatchWhereInput[] = [];
  if (query.gameId || query.tournamentId) {
    filters.push({
      round: { tournament: { id: query.tournamentId, gameId: query.gameId } },
    });
  }
  if (query.teamId)
    filters.push({
      OR: [{ teamAId: query.teamId }, { teamBId: query.teamId }],
    });
  if (query.search?.trim()) {
    const contains = {
      contains: query.search.trim(),
      mode: 'insensitive' as const,
    };
    filters.push({
      OR: [
        { round: { tournament: { name: contains } } },
        { teamA: { name: contains } },
        { teamB: { name: contains } },
      ],
    });
  }
  if (query.from || query.to) {
    const gte = query.from ? new Date(query.from) : undefined;
    const lte = query.to ? new Date(query.to) : undefined;
    if (gte && lte && gte > lte)
      throw new BadRequestException('Start date must not be after end date');
    filters.push({
      OR: [
        { status: 'COMPLETED', playedAt: { gte, lte } },
        { status: 'COMPLETED', playedAt: null, scheduledAt: { gte, lte } },
        { status: { not: 'COMPLETED' }, scheduledAt: { gte, lte } },
      ],
    });
  }
  if (query.attention) {
    const checkIn: Prisma.MatchWhereInput = {
      status: 'PENDING',
      scheduledAt: {
        gte: now,
        lte: new Date(now.getTime() + MATCH_CHECK_IN_WINDOW_MINUTES * 60_000),
      },
      OR: captainTeamIds.map((teamId) => ({
        OR: [{ teamAId: teamId }, { teamBId: teamId }],
        checkIns: { none: { teamId } },
      })),
    };
    const overdueCheckInFor = (teamIds: string[]): Prisma.MatchWhereInput => ({
      status: 'PENDING',
      scheduledAt: { lt: now },
      OR: teamIds.map((teamId) => ({
        OR: [{ teamAId: teamId }, { teamBId: teamId }],
        checkIns: { none: { teamId } },
      })),
    });
    const overdueCheckIn = overdueCheckInFor(userTeamIds);
    const confirm: Prisma.MatchWhereInput = {
      status: 'COMPLETED',
      OR: captainTeamIds.map((teamId) => ({
        OR: [{ teamAId: teamId }, { teamBId: teamId }],
        resultReview: {
          is: {
            status: 'PENDING_CONFIRMATION',
            responses: { none: { teamId } },
          },
        },
      })),
    };
    const disputed: Prisma.MatchWhereInput = {
      status: 'COMPLETED',
      resultReview: { is: { status: 'DISPUTED' } },
    };
    const byAttention: Record<
      NonNullable<MyMatchesQueryDto['attention']>,
      Prisma.MatchWhereInput
    > = {
      CHECK_IN: checkIn,
      OVERDUE_CHECK_IN: overdueCheckIn,
      CONFIRM: confirm,
      DISPUTED: disputed,
      NEEDS_ACTION: {
        OR: [checkIn, overdueCheckInFor(captainTeamIds), confirm, disputed],
      },
    };
    filters.push(byAttention[query.attention]);
  }
  return filters;
}
