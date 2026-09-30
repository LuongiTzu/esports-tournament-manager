import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MatchCheckInDto } from './dto/match-check-in.dto';
import {
  getMatchCheckInWindow,
  isMatchCheckInOpen,
} from './domain/match-check-in.policy';

const checkInSelect = {
  id: true,
  matchId: true,
  teamId: true,
  checkedInAt: true,
} as const;

@Injectable()
export class MatchCheckInService {
  constructor(private readonly prisma: PrismaService) {}

  async checkIn(matchId: string, userId: string, dto: MatchCheckInDto) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      select: {
        id: true,
        status: true,
        isActive: true,
        isBye: true,
        scheduledAt: true,
        teamA: { select: { id: true, captainId: true, status: true } },
        teamB: { select: { id: true, captainId: true, status: true } },
        checkIns: {
          where: { teamId: dto.teamId },
          select: checkInSelect,
          take: 1,
        },
      },
    });
    if (!match) throw new NotFoundException('Match not found');

    const team = [match.teamA, match.teamB].find(
      (candidate) => candidate?.id === dto.teamId,
    );
    if (!team) {
      throw new ForbiddenException('Team is not assigned to this match');
    }
    if (team.captainId !== userId) {
      throw new ForbiddenException('Only the team captain can check in');
    }
    if (team.status !== RegistrationStatus.APPROVED) {
      throw new ConflictException('Only approved teams can check in');
    }

    const existing = match.checkIns[0];
    if (existing) return existing;

    if (!match.isActive || match.isBye) {
      throw new ConflictException('This match does not accept check-ins');
    }
    if (match.status !== MatchStatus.PENDING) {
      throw new ConflictException('Only pending matches accept check-ins');
    }
    if (!match.scheduledAt) {
      throw new BadRequestException(
        'The match must be scheduled before check-in',
      );
    }

    const now = new Date();
    if (!isMatchCheckInOpen(match.scheduledAt, now)) {
      const { opensAt, closesAt } = getMatchCheckInWindow(match.scheduledAt);
      throw new ConflictException({
        message: 'Match check-in is outside the allowed window',
        code: 'MATCH_CHECK_IN_WINDOW_CLOSED',
        details: {
          opensAt: opensAt.toISOString(),
          closesAt: closesAt.toISOString(),
        },
      });
    }

    return this.prisma.matchCheckIn.upsert({
      where: { matchId_teamId: { matchId, teamId: dto.teamId } },
      create: { matchId, teamId: dto.teamId, checkedInById: userId },
      update: {},
      select: checkInSelect,
    });
  }
}
