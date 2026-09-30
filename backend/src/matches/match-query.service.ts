import { Injectable, NotFoundException } from '@nestjs/common';
import { MatchStatus, Prisma, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { withTournamentGameDisplayName } from '../tournaments/domain/tournament-game-display';
import { MyMatchesQueryDto } from './dto/my-matches-query.dto';
import { getMatchCheckInWindow } from './domain/match-check-in.policy';

const publicTeamSelect = {
  id: true,
  name: true,
  shortName: true,
  logoUrl: true,
  seed: true,
} as const;

const myMatchSelect = Prisma.validator<Prisma.MatchSelect>()({
  id: true,
  status: true,
  outcome: true,
  scoreA: true,
  scoreB: true,
  bestOf: true,
  bracketRound: true,
  matchNumber: true,
  scheduledAt: true,
  playedAt: true,
  discordLink: true,
  checkIns: {
    select: { id: true, matchId: true, teamId: true, checkedInAt: true },
    orderBy: { checkedInAt: 'asc' },
  },
  teamA: { select: publicTeamSelect },
  teamB: { select: publicTeamSelect },
  winner: { select: publicTeamSelect },
  round: {
    select: {
      id: true,
      name: true,
      format: true,
      tournament: {
        select: {
          id: true,
          name: true,
          slug: true,
          status: true,
          mode: true,
          location: true,
          customGameName: true,
          game: {
            select: { id: true, code: true, name: true, iconUrl: true },
          },
        },
      },
    },
  },
});

type MyMatchRecord = Prisma.MatchGetPayload<{ select: typeof myMatchSelect }>;

function toMyMatch(
  match: MyMatchRecord,
  userTeamIds: Set<string>,
  captainTeamIds: Set<string>,
) {
  const assignedTeamIds = [match.teamA?.id, match.teamB?.id].filter(
    (teamId): teamId is string => teamId !== undefined,
  );
  return {
    ...match,
    checkIns: match.checkIns.filter((checkIn) =>
      assignedTeamIds.includes(checkIn.teamId),
    ),
    checkInWindow: match.scheduledAt
      ? getMatchCheckInWindow(match.scheduledAt)
      : null,
    userTeamIds: assignedTeamIds.filter((teamId) => userTeamIds.has(teamId)),
    captainTeamIds: assignedTeamIds.filter((teamId) =>
      captainTeamIds.has(teamId),
    ),
    round: {
      ...match.round,
      tournament: withTournamentGameDisplayName(match.round.tournament),
    },
  };
}

@Injectable()
export class MatchQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findOne(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        scores: { orderBy: { setNumber: 'asc' } },
        teamA: { select: publicTeamSelect },
        teamB: { select: publicTeamSelect },
        winner: { select: publicTeamSelect },
        round: {
          select: {
            id: true,
            name: true,
            format: true,
            tournament: { select: { id: true, name: true, slug: true } },
          },
        },
      },
    });
    if (!match) throw new NotFoundException('Match not found');
    return match;
  }

  async findForUser(userId: string, query: MyMatchesQueryDto) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 12, 50);
    const teams = await this.prisma.team.findMany({
      where: {
        status: RegistrationStatus.APPROVED,
        OR: [{ captainId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true, captainId: true },
    });
    const userTeamIds = new Set(teams.map((team) => team.id));
    const captainTeamIds = new Set(
      teams.filter((team) => team.captainId === userId).map((team) => team.id),
    );

    if (userTeamIds.size === 0) {
      return {
        data: [],
        nextMatch: null,
        summary: { total: 0, pending: 0, ongoing: 0, completed: 0 },
        pagination: { page, limit, total: 0, totalPages: 0 },
      };
    }

    const teamIds = [...userTeamIds];
    const baseWhere: Prisma.MatchWhereInput = {
      isActive: true,
      isBye: false,
      OR: [{ teamAId: { in: teamIds } }, { teamBId: { in: teamIds } }],
    };
    const where: Prisma.MatchWhereInput = {
      ...baseWhere,
      status: query.status,
    };
    const orderBy: Prisma.MatchOrderByWithRelationInput[] =
      query.status === MatchStatus.COMPLETED
        ? [{ playedAt: { sort: 'desc', nulls: 'last' } }, { updatedAt: 'desc' }]
        : query.status === MatchStatus.ONGOING
          ? [
              { scheduledAt: { sort: 'desc', nulls: 'last' } },
              { updatedAt: 'desc' },
            ]
          : [
              { scheduledAt: { sort: 'asc', nulls: 'last' } },
              { createdAt: 'asc' },
            ];

    const [data, total, nextMatch, statusGroups] = await Promise.all([
      this.prisma.match.findMany({
        where,
        select: myMatchSelect,
        skip: (page - 1) * limit,
        take: limit,
        orderBy,
      }),
      this.prisma.match.count({ where }),
      this.prisma.match.findFirst({
        where: {
          ...baseWhere,
          status: MatchStatus.PENDING,
          scheduledAt: { gte: new Date() },
        },
        select: myMatchSelect,
        orderBy: { scheduledAt: 'asc' },
      }),
      this.prisma.match.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      }),
    ]);
    const summary = {
      total: 0,
      pending: 0,
      ongoing: 0,
      completed: 0,
    };
    for (const group of statusGroups) {
      const count = group._count._all;
      summary.total += count;
      if (group.status === MatchStatus.PENDING) summary.pending = count;
      if (group.status === MatchStatus.ONGOING) summary.ongoing = count;
      if (group.status === MatchStatus.COMPLETED) summary.completed = count;
    }

    return {
      data: data.map((match) => toMyMatch(match, userTeamIds, captainTeamIds)),
      nextMatch: nextMatch
        ? toMyMatch(nextMatch, userTeamIds, captainTeamIds)
        : null,
      summary,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
