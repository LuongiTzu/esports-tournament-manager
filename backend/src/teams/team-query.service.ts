import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MatchOutcome,
  MatchStatus,
  Prisma,
  RegistrationStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

const PUBLIC_MEMBER_SELECT = {
  id: true,
  realName: true,
  ign: true,
  position: true,
  memberRole: true,
  avatarUrl: true,
  orderIndex: true,
} as const;
const CAPTAIN_SELECT = {
  id: true,
  displayName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class TeamQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async findByTournament(
    slug: string,
    viewerId: string | undefined,
    status?: string,
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      select: { id: true, organizerId: true },
    });

    if (!tournament) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    const isOrganizer = tournament.organizerId === viewerId;
    const where: Prisma.TeamWhereInput = { tournamentId: tournament.id };

    if (!isOrganizer) {
      where.status = RegistrationStatus.APPROVED;
    } else if (status && status !== 'ALL') {
      const parsed = status.toUpperCase();
      if (!(parsed in RegistrationStatus)) {
        throw new BadRequestException('Trạng thái lọc không hợp lệ');
      }
      where.status = parsed as RegistrationStatus;
    }

    return this.prisma.team.findMany({
      where,
      orderBy: { registeredAt: 'asc' },
      include: {
        captain: { select: CAPTAIN_SELECT },
        members: {
          orderBy: { orderIndex: 'asc' },
          select: PUBLIC_MEMBER_SELECT,
        },
        _count: { select: { members: true } },
      },
    });
  }
  async findOne(teamId: string, viewerId?: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        captain: { select: CAPTAIN_SELECT },
        tournament: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            organizerId: true,
          },
        },
        members: { orderBy: { orderIndex: 'asc' } },
      },
    });

    if (!team) {
      throw new NotFoundException('Không tìm thấy đội');
    }

    const completedMatches = await this.prisma.match.findMany({
      where: {
        status: MatchStatus.COMPLETED,
        OR: [{ teamAId: team.id }, { teamBId: team.id }],
      },
      orderBy: [{ playedAt: 'desc' }, { updatedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        scoreA: true,
        scoreB: true,
        winnerTeamId: true,
        outcome: true,
        scheduledAt: true,
        playedAt: true,
        teamA: { select: { id: true, name: true, shortName: true } },
        teamB: { select: { id: true, name: true, shortName: true } },
        round: { select: { id: true, name: true, format: true } },
      },
    });
    const history = {
      completedMatches: completedMatches.length,
      wins: completedMatches.filter((match) => match.winnerTeamId === team.id)
        .length,
      draws: completedMatches.filter(
        (match) => match.outcome === MatchOutcome.DRAW,
      ).length,
      losses: completedMatches.filter(
        (match) =>
          match.winnerTeamId !== null && match.winnerTeamId !== team.id,
      ).length,
      finalRank: team.finalRank,
      recentMatches: completedMatches.slice(0, 10),
    };

    const isPrivileged =
      !!viewerId &&
      (team.tournament.organizerId === viewerId ||
        team.captainId === viewerId ||
        team.members.some((m) => m.userId === viewerId));

    if (isPrivileged) {
      return { ...team, history, canViewSensitiveInfo: true };
    }

    return {
      ...team,
      history,
      contactEmail: null,
      contactPhone: null,
      rejectReason: null,
      members: team.members.map((m) => ({
        id: m.id,
        realName: m.realName,
        ign: m.ign,
        position: m.position,
        memberRole: m.memberRole,
        avatarUrl: m.avatarUrl,
        orderIndex: m.orderIndex,
      })),
      canViewSensitiveInfo: false,
    };
  }
  async findMyTeams(userId: string) {
    return this.prisma.team.findMany({
      where: {
        OR: [{ captainId: userId }, { members: { some: { userId } } }],
      },
      orderBy: { registeredAt: 'desc' },
      include: {
        tournament: {
          select: {
            id: true,
            slug: true,
            name: true,
            status: true,
            bannerUrl: true,
            startDate: true,
            game: { select: { id: true, name: true, iconUrl: true } },
          },
        },
        captain: { select: CAPTAIN_SELECT },
        _count: { select: { members: true } },
      },
    });
  }
}
