import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MatchStatus,
  ModerationStatus,
  Prisma,
  RoundFormat,
  RoundStatus,
  TournamentMode,
  TournamentStatus,
  Visibility,
} from '@prisma/client';
import { RoundSettingsService } from '../brackets/round-settings.service';
import { StandingsService } from '../brackets/standings.service';
import {
  resolveSwissNumberOfRounds,
  SwissSettings,
} from '../brackets/types/round-settings';
import { tournamentVisibilityPolicy } from '../common/policies/tournament-visibility.policy';
import { PrismaService } from '../prisma/prisma.service';
import {
  PUBLIC_TOURNAMENT_TEAM_SELECT,
  TOURNAMENT_GAME_SELECT,
} from './tournament-prisma.select';
import { withTournamentGameDisplayName } from './domain/tournament-game-display';

@Injectable()
export class TournamentQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roundSettingsService: RoundSettingsService,
    private readonly standingsService: StandingsService,
  ) {}

  async findAllPublic(
    query: {
      search?: string;
      gameId?: string;
      status?: TournamentStatus;
      mode?: TournamentMode;
      isVerified?: boolean;
      page?: number;
      limit?: number;
    },
    userId?: string,
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(50, query.limit ?? 20);
    const skip = (page - 1) * limit;

    const where: Prisma.TournamentWhereInput = {
      visibility: Visibility.PUBLIC,
      moderationStatus: ModerationStatus.ACTIVE,
    };

    if (query.gameId) {
      where.gameId = query.gameId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.mode) {
      where.mode = query.mode;
    }

    if (query.isVerified !== undefined) {
      where.isVerified = query.isVerified;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { game: { name: { contains: query.search, mode: 'insensitive' } } },
        {
          customGameName: {
            contains: query.search,
            mode: 'insensitive',
          },
        },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.tournament.findMany({
        where,
        skip,
        take: limit,
        orderBy: [
          { isVerified: 'desc' },
          { startDate: 'asc' },
          { createdAt: 'desc' },
        ],
        include: {
          game: { select: TOURNAMENT_GAME_SELECT },
          favorites: viewerFavoriteSelection(userId),
          _count: { select: { teams: true, favorites: true } },
        },
      }),
      this.prisma.tournament.count({ where }),
    ]);

    return {
      data: data.map((tournament) =>
        withTournamentFavoriteState(withTournamentGameDisplayName(tournament)),
      ),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findBySlug(slug: string, userId?: string, userRole?: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      include: {
        game: {
          select: TOURNAMENT_GAME_SELECT,
        },
        organizer: {
          select: { id: true, displayName: true, avatarUrl: true },
        },
        rounds: {
          orderBy: { orderIndex: 'asc' },
          include: {
            groups: { orderBy: { orderIndex: 'asc' } },
            _count: { select: { matches: true } },
          },
        },
        teams: {
          where: { status: 'APPROVED' },
          include: {
            captain: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
            _count: { select: { members: true } },
          },
        },
        favorites: viewerFavoriteSelection(userId),
        _count: {
          select: { teams: true, comments: true, favorites: true },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    if (!(await this.canViewTournament(tournament, userId, userRole))) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    return withTournamentFavoriteState(
      withTournamentGameDisplayName({
        ...tournament,
        rounds: tournament.rounds.map((round) => ({
          ...round,
          settings: this.roundSettingsService.getEffectiveSettings(
            round.format,
            round.settings,
          ),
        })),
      }),
    );
  }

  async findMyTournaments(
    userId: string,
    tab: 'organized' | 'joined',
    userRole?: string,
  ) {
    if (tab !== 'organized' && tab !== 'joined') {
      throw new BadRequestException('Tab must be organized or joined');
    }
    if (tab === 'organized') {
      const tournaments = await this.prisma.tournament.findMany({
        where: { organizerId: userId },
        orderBy: { createdAt: 'desc' },
        include: {
          game: { select: { id: true, code: true, name: true, iconUrl: true } },
          favorites: viewerFavoriteSelection(userId),
          _count: { select: { teams: true, favorites: true } },
        },
      });
      return tournaments.map((tournament) =>
        withTournamentFavoriteState(withTournamentGameDisplayName(tournament)),
      );
    }

    // joined: giải có đội mà user là captain hoặc thành viên
    const teams = await this.prisma.team.findMany({
      where: {
        OR: [{ captainId: userId }, { members: { some: { userId } } }],
      },
      select: { tournamentId: true },
    });

    const tournamentIds = [...new Set(teams.map((t) => t.tournamentId))];

    const tournaments = await this.prisma.tournament.findMany({
      where: {
        id: { in: tournamentIds },
        moderationStatus:
          userRole === 'ADMIN' ? undefined : ModerationStatus.ACTIVE,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        game: { select: { id: true, code: true, name: true, iconUrl: true } },
        favorites: viewerFavoriteSelection(userId),
        _count: { select: { teams: true, favorites: true } },
      },
    });
    return tournaments.map((tournament) =>
      withTournamentFavoriteState(withTournamentGameDisplayName(tournament)),
    );
  }

  async findFavoriteTournaments(userId: string, userRole?: string) {
    const favorites = await this.prisma.tournamentFavorite.findMany({
      where: { userId },
      orderBy: [{ createdAt: 'desc' }, { tournamentId: 'asc' }],
      include: {
        tournament: {
          include: {
            game: {
              select: { id: true, code: true, name: true, iconUrl: true },
            },
            favorites: viewerFavoriteSelection(userId),
            _count: { select: { teams: true, favorites: true } },
            teams: {
              select: {
                captainId: true,
                members: {
                  where: { userId: { not: null } },
                  select: { userId: true },
                },
              },
            },
          },
        },
      },
    });
    const user = { id: userId, role: userRole ?? '' };

    return favorites.flatMap(({ tournament }) => {
      const { teams, ...visibleTournament } = tournament;
      const relatedUserIds = new Set(
        teams.flatMap((team) => [
          team.captainId,
          ...team.members.map((member) => member.userId),
        ]),
      );
      if (
        !tournamentVisibilityPolicy.canView({
          ...visibleTournament,
          user,
          isRelatedParticipant: relatedUserIds.has(userId),
        })
      ) {
        return [];
      }
      return [
        withTournamentFavoriteState(
          withTournamentGameDisplayName(visibleTournament),
        ),
      ];
    });
  }

  async getStandings(slug: string, userId?: string, userRole?: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        status: true,
        organizerId: true,
        visibility: true,
        moderationStatus: true,
        teams: {
          where: { finalRank: 1 },
          take: 1,
          select: PUBLIC_TOURNAMENT_TEAM_SELECT,
        },
        rounds: {
          select: {
            id: true,
            name: true,
            orderIndex: true,
            format: true,
            status: true,
            settings: true,
            matches: {
              select: { status: true, isActive: true, bracketRound: true },
            },
            participants: {
              orderBy: { createdAt: 'asc' },
              select: {
                createdAt: true,
                team: { select: PUBLIC_TOURNAMENT_TEAM_SELECT },
                advancedFromRound: {
                  select: {
                    id: true,
                    name: true,
                    orderIndex: true,
                    format: true,
                  },
                },
              },
            },
            advancedTeams: {
              orderBy: { createdAt: 'asc' },
              select: {
                createdAt: true,
                team: { select: PUBLIC_TOURNAMENT_TEAM_SELECT },
                round: {
                  select: {
                    id: true,
                    name: true,
                    orderIndex: true,
                    format: true,
                    status: true,
                  },
                },
              },
            },
          },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
    if (!tournament) throw new NotFoundException('Không tìm thấy giải đấu');
    if (!(await this.canViewTournament(tournament, userId, userRole))) {
      throw new NotFoundException('Tournament not found');
    }
    const calculated = await this.standingsService.forTournament(
      tournament.id,
      tournament.rounds,
    );
    const standingsByRound = new Map(
      calculated.rounds.map((round) => [round.roundId, round.standings]),
    );
    return {
      tournamentId: tournament.id,
      tournament: {
        id: tournament.id,
        name: tournament.name,
        status: tournament.status,
        champion: tournament.teams[0] ?? null,
      },
      rounds: tournament.rounds.map((round, index) => {
        const nextRound = tournament.rounds[index + 1] ?? null;
        const roundStandings = standingsByRound.get(round.id) ?? [];
        const requiredMatches = round.matches.filter((match) => match.isActive);
        const completedRequiredMatches = requiredMatches.filter(
          (match) => match.status === MatchStatus.COMPLETED,
        ).length;
        const allRequiredMatchesCompleted =
          requiredMatches.length > 0 &&
          completedRequiredMatches === requiredMatches.length;
        const advancementSupported =
          round.format === RoundFormat.GROUP_STAGE ||
          round.format === RoundFormat.SWISS;
        const currentSwissIteration =
          round.format === RoundFormat.SWISS
            ? Math.max(
                0,
                ...round.matches.map((match) => match.bracketRound ?? 0),
              )
            : null;
        const requiredSwissIterations =
          round.format === RoundFormat.SWISS
            ? resolveSwissNumberOfRounds(
                roundStandings.length,
                (
                  this.roundSettingsService.getEffectiveSettings(
                    RoundFormat.SWISS,
                    round.settings,
                  ) as SwissSettings
                ).numberOfRounds,
              )
            : null;
        const swissFinalIterationReached =
          currentSwissIteration === null ||
          requiredSwissIterations === null ||
          currentSwissIteration === requiredSwissIterations;
        const progressionState = !round.matches.length
          ? 'NOT_GENERATED'
          : !allRequiredMatchesCompleted
            ? 'IN_PROGRESS'
            : !swissFinalIterationReached
              ? 'IN_PROGRESS'
              : !nextRound
                ? 'TERMINAL_COMPLETE'
                : !advancementSupported
                  ? 'ADVANCEMENT_UNSUPPORTED'
                  : !round.advancedTeams.length
                    ? 'AWAITING_ADVANCEMENT'
                    : !nextRound.matches.length
                      ? 'READY_FOR_GENERATION'
                      : nextRound.status === RoundStatus.COMPLETED
                        ? 'NEXT_STAGE_COMPLETED'
                        : 'NEXT_STAGE_GENERATED';
        const readinessReason = !round.matches.length
          ? 'Giai đoạn chưa được tạo.'
          : !allRequiredMatchesCompleted
            ? `Còn ${requiredMatches.length - completedRequiredMatches} trận bắt buộc chưa hoàn tất.`
            : !swissFinalIterationReached
              ? `Swiss mới hoàn tất ${currentSwissIteration}/${requiredSwissIterations} lượt ghép cặp.`
              : progressionState === 'AWAITING_ADVANCEMENT'
                ? 'Giai đoạn đã hoàn tất và đủ điều kiện để hệ thống xác định đội đi tiếp.'
                : progressionState === 'READY_FOR_GENERATION'
                  ? 'Đội đi tiếp đã được lưu; vòng tiếp theo đang chờ tạo cấu trúc.'
                  : progressionState === 'ADVANCEMENT_UNSUPPORTED'
                    ? 'Thể thức hiện tại không có quy tắc chuyển vòng được cấu hình.'
                    : null;

        return {
          roundId: round.id,
          format: round.format,
          round: {
            id: round.id,
            name: round.name,
            orderIndex: round.orderIndex,
            format: round.format,
            status: round.status,
          },
          standings: roundStandings,
          progress: {
            totalMatches: round.matches.length,
            completedMatches: round.matches.filter(
              (match) => match.status === MatchStatus.COMPLETED,
            ).length,
            requiredMatches: requiredMatches.length,
            completedRequiredMatches,
            allRequiredMatchesCompleted,
          },
          participants: round.participants,
          advancement: {
            supported: advancementSupported,
            state: progressionState,
            readinessReason,
            nextRound: nextRound
              ? {
                  id: nextRound.id,
                  name: nextRound.name,
                  orderIndex: nextRound.orderIndex,
                  format: nextRound.format,
                  status: nextRound.status,
                  participantCount: nextRound.participants.length,
                  matchCount: nextRound.matches.length,
                }
              : null,
            qualifiedTeams: round.advancedTeams.map((assignment) => ({
              team: assignment.team,
              targetRound: assignment.round,
              advancedAt: assignment.createdAt,
            })),
          },
        };
      }),
    };
  }

  async getSchedule(slug: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        rounds: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            name: true,
            orderIndex: true,
            matches: {
              orderBy: [
                { scheduledAt: 'asc' },
                { bracketRound: 'asc' },
                { matchNumber: 'asc' },
              ],
              include: {
                teamA: { select: PUBLIC_TOURNAMENT_TEAM_SELECT },
                teamB: { select: PUBLIC_TOURNAMENT_TEAM_SELECT },
              },
            },
          },
        },
      },
    });
    if (!tournament) throw new NotFoundException('Không tìm thấy giải đấu');
    return {
      tournament: { id: tournament.id, name: tournament.name, slug },
      rounds: tournament.rounds.map((round) => {
        const dates = new Map<string, typeof round.matches>();
        for (const match of round.matches) {
          const date = match.scheduledAt
            ? match.scheduledAt.toISOString().slice(0, 10)
            : 'UNSCHEDULED';
          dates.set(date, [...(dates.get(date) ?? []), match]);
        }
        return {
          id: round.id,
          name: round.name,
          orderIndex: round.orderIndex,
          dates: [...dates].map(([date, matches]) => ({ date, matches })),
        };
      }),
    };
  }

  async getBracket(slug: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      select: {
        id: true,
        name: true,
        slug: true,
        rounds: {
          orderBy: { orderIndex: 'asc' },
          include: {
            groups: {
              orderBy: { orderIndex: 'asc' },
              include: {
                teamAssignments: {
                  include: { team: { select: PUBLIC_TOURNAMENT_TEAM_SELECT } },
                },
              },
            },
            matches: {
              orderBy: [{ bracketRound: 'asc' }, { matchNumber: 'asc' }],
              include: {
                teamA: { select: PUBLIC_TOURNAMENT_TEAM_SELECT },
                teamB: { select: PUBLIC_TOURNAMENT_TEAM_SELECT },
                winner: { select: PUBLIC_TOURNAMENT_TEAM_SELECT },
              },
            },
          },
        },
      },
    });
    if (!tournament) throw new NotFoundException('Không tìm thấy giải đấu');
    return {
      tournament: { id: tournament.id, name: tournament.name, slug },
      rounds: tournament.rounds.map((round) => ({
        round: {
          id: round.id,
          name: round.name,
          orderIndex: round.orderIndex,
          format: round.format,
          status: round.status,
          bestOf: round.bestOf,
          settings: this.roundSettingsService.getEffectiveSettings(
            round.format,
            round.settings,
          ),
        },
        groups: round.groups.map((group) => ({
          id: group.id,
          name: group.name,
          orderIndex: group.orderIndex,
          teams: group.teamAssignments.map((assignment) => assignment.team),
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
          slots: { A: match.teamA, B: match.teamB },
          score: { A: match.scoreA, B: match.scoreB },
          winner: match.winner,
          nextMatch: { id: match.nextMatchId, slot: match.nextMatchSlot },
          loserNextMatch: {
            id: match.loserNextMatchId,
            slot: match.loserNextMatchSlot,
          },
        })),
      })),
    };
  }

  private async canViewTournament(
    tournament: {
      id: string;
      organizerId: string;
      visibility: Visibility;
      moderationStatus: ModerationStatus;
    },
    userId?: string,
    userRole?: string,
  ) {
    const user = userId ? { id: userId, role: userRole ?? '' } : undefined;
    if (tournamentVisibilityPolicy.canView({ ...tournament, user })) {
      return true;
    }
    if (
      !user ||
      tournament.visibility !== Visibility.PRIVATE ||
      tournament.moderationStatus === ModerationStatus.HIDDEN_BY_ADMIN
    ) {
      return false;
    }
    const team = await this.prisma.team.findFirst({
      where: {
        tournamentId: tournament.id,
        OR: [{ captainId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true },
    });
    return tournamentVisibilityPolicy.canView({
      ...tournament,
      user,
      isRelatedParticipant: team !== null,
    });
  }
}

function viewerFavoriteSelection(userId?: string) {
  return {
    where: userId ? { userId } : { userId: { in: [] as string[] } },
    select: { userId: true },
    take: 1,
  } as const;
}

function withTournamentFavoriteState<
  T extends {
    favorites?: ReadonlyArray<unknown>;
    _count?: { favorites?: number };
  },
>(tournament: T) {
  const { favorites = [], ...readModel } = tournament;
  return {
    ...readModel,
    favoriteCount: tournament._count?.favorites ?? 0,
    isFavorited: favorites.length > 0,
  };
}
