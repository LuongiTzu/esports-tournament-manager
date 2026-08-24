import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RoundSettingsService } from './round-settings.service';

const PUBLIC_BRACKET_TEAM_SELECT = {
  id: true,
  name: true,
  shortName: true,
  logoUrl: true,
  seed: true,
} as const;

export interface PublicBracketTeam {
  id: string;
  name: string;
  shortName: string | null;
  logoUrl: string | null;
  seed: number | null;
}

@Injectable()
export class BracketQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: RoundSettingsService,
  ) {}

  async getBracket(roundId: string) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      include: {
        groups: {
          orderBy: { orderIndex: 'asc' },
          include: {
            teamAssignments: {
              include: { team: { select: PUBLIC_BRACKET_TEAM_SELECT } },
            },
          },
        },
        matches: {
          orderBy: [{ bracketRound: 'asc' }, { matchNumber: 'asc' }],
          include: {
            teamA: { select: PUBLIC_BRACKET_TEAM_SELECT },
            teamB: { select: PUBLIC_BRACKET_TEAM_SELECT },
            winner: { select: PUBLIC_BRACKET_TEAM_SELECT },
          },
        },
      },
    });
    if (!round) throw new NotFoundException('Không tìm thấy vòng đấu');
    return {
      round: {
        id: round.id,
        name: round.name,
        format: round.format,
        status: round.status,
        bestOf: round.bestOf,
        settings: this.settingsService.getEffectiveSettings(
          round.format,
          round.settings,
        ),
      },
      groups: round.groups.map((group) => ({
        id: group.id,
        name: group.name,
        orderIndex: group.orderIndex,
        teams: group.teamAssignments.map((assignment) =>
          toPublicBracketTeam(assignment.team),
        ),
      })),
      matches: round.matches.map((match) => ({
        id: match.id,
        groupId: match.groupId,
        bracketRound: match.bracketRound,
        bracketType: match.bracketType,
        matchNumber: match.matchNumber,
        status: match.status,
        outcome: match.outcome,
        isActive: match.isActive,
        activationCondition: match.activationCondition,
        isBye: match.isBye,
        bestOf: match.bestOf,
        scheduledAt: match.scheduledAt,
        slots: {
          A: toPublicBracketTeam(match.teamA),
          B: toPublicBracketTeam(match.teamB),
        },
        score: { A: match.scoreA, B: match.scoreB },
        winner: toPublicBracketTeam(match.winner),
        nextMatch: { id: match.nextMatchId, slot: match.nextMatchSlot },
        loserNextMatch: {
          id: match.loserNextMatchId,
          slot: match.loserNextMatchSlot,
        },
      })),
    };
  }
}

function toPublicBracketTeam(
  team: PublicBracketTeam | null,
): PublicBracketTeam | null {
  return team
    ? {
        id: team.id,
        name: team.name,
        shortName: team.shortName,
        logoUrl: team.logoUrl,
        seed: team.seed,
      }
    : null;
}
