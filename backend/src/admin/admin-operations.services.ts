import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ModerationStatus,
  Prisma,
  ReportStatus,
  TournamentStatus,
} from '@prisma/client';
import { ContentFilterService } from '../common/services/content-filter.service';
import { PrismaService } from '../prisma/prisma.service';
import { withTournamentGameDisplayName } from '../tournaments/domain/tournament-game-display';
import {
  CreateBannedKeywordDto,
  UpdateBannedKeywordDto,
} from './dto/banned-keyword.dto';

@Injectable()
export class AdminDashboardQueryService {
  constructor(private readonly prisma: PrismaService) {}

  async stats(periodDays: 7 | 30 = 7) {
    const now = new Date();
    const todayStart = startOfVietnamDay(now);
    const tomorrowStart = addUtcDays(todayStart, 1);
    const currentPeriodStart = addUtcDays(todayStart, -(periodDays - 1));
    const previousPeriodStart = addUtcDays(currentPeriodStart, -periodDays);
    const lastSevenDaysStart = addUtcDays(todayStart, -6);

    const [
      totalTournaments,
      totalUsers,
      ongoingTournaments,
      officialTournaments,
      totalMatches,
      matchesToday,
      pendingReports,
      reportedTournamentRows,
      lockedTournaments,
      lockedAccounts,
      recentUserRows,
      recentTournamentRows,
      statusRows,
      gameRows,
      recentReports,
      recentTournaments,
    ] = await Promise.all([
      this.prisma.tournament.count(),
      this.prisma.user.count(),
      this.prisma.tournament.count({
        where: { status: TournamentStatus.ONGOING },
      }),
      this.prisma.tournament.count({ where: { isOfficial: true } }),
      this.prisma.match.count({ where: { isActive: true, isBye: false } }),
      this.prisma.match.count({
        where: {
          isActive: true,
          isBye: false,
          scheduledAt: { gte: todayStart, lt: tomorrowStart },
        },
      }),
      this.prisma.report.count({ where: { status: ReportStatus.PENDING } }),
      this.prisma.report.groupBy({
        by: ['tournamentId'],
        where: { status: ReportStatus.PENDING },
      }),
      this.prisma.tournament.count({
        where: { moderationStatus: ModerationStatus.HIDDEN_BY_ADMIN },
      }),
      this.prisma.user.count({ where: { isLocked: true } }),
      this.prisma.user.findMany({
        where: {
          createdAt: { gte: previousPeriodStart, lt: tomorrowStart },
        },
        select: { createdAt: true },
      }),
      this.prisma.tournament.findMany({
        where: {
          createdAt: { gte: previousPeriodStart, lt: tomorrowStart },
        },
        select: { createdAt: true },
      }),
      this.prisma.tournament.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
      this.prisma.tournament.groupBy({
        by: ['gameId', 'customGameName'],
        _count: { _all: true },
      }),
      this.prisma.report.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          reason: true,
          status: true,
          createdAt: true,
          tournament: { select: { id: true, name: true, slug: true } },
          reporter: { select: { id: true, displayName: true } },
        },
      }),
      this.prisma.tournament.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          name: true,
          slug: true,
          bannerUrl: true,
          status: true,
          isOfficial: true,
          createdAt: true,
          customGameName: true,
          organizer: { select: { id: true, displayName: true } },
          game: { select: { id: true, code: true, name: true } },
        },
      }),
    ]);

    const gameIds = [...new Set(gameRows.map((row) => row.gameId))];
    const games = gameIds.length
      ? await this.prisma.game.findMany({
          where: { id: { in: gameIds } },
          select: { id: true, code: true, name: true },
        })
      : [];
    const gameById = new Map(games.map((game) => [game.id, game]));

    const currentUsers = countRowsInRange(
      recentUserRows,
      currentPeriodStart,
      tomorrowStart,
    );
    const previousUsers = countRowsInRange(
      recentUserRows,
      previousPeriodStart,
      currentPeriodStart,
    );
    const currentTournaments = countRowsInRange(
      recentTournamentRows,
      currentPeriodStart,
      tomorrowStart,
    );
    const previousTournaments = countRowsInRange(
      recentTournamentRows,
      previousPeriodStart,
      currentPeriodStart,
    );
    const tournamentsCreatedLast7Days = countRowsInRange(
      recentTournamentRows,
      lastSevenDaysStart,
      tomorrowStart,
    );

    return {
      periodDays,
      totalTournaments,
      totalUsers,
      newUsers: currentUsers,
      userGrowthPercent: growthPercent(currentUsers, previousUsers),
      ongoingTournaments,
      officialTournaments,
      newTournaments: currentTournaments,
      tournamentGrowthPercent: growthPercent(
        currentTournaments,
        previousTournaments,
      ),
      totalMatches,
      matchesToday,
      pendingReports,
      tournamentsWithPendingReports: reportedTournamentRows.length,
      hiddenTournaments: lockedTournaments,
      tournamentsBeingReported: reportedTournamentRows.length,
      lockedTournaments,
      lockedAccounts,
      tournamentsCreatedLast7Days,
      dailyGrowth: buildDailyGrowth(
        currentPeriodStart,
        periodDays,
        recentUserRows,
        recentTournamentRows,
      ),
      tournamentStatusDistribution: Object.values(TournamentStatus).map(
        (status) => ({
          status,
          count:
            statusRows.find((row) => row.status === status)?._count._all ?? 0,
        }),
      ),
      topGames: aggregateTopGames(gameRows, gameById),
      recentReports,
      recentTournaments: recentTournaments.map((tournament) =>
        withTournamentGameDisplayName(tournament),
      ),
    };
  }
}

const VIETNAM_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

function startOfVietnamDay(value: Date) {
  const vietnamTime = new Date(value.getTime() + VIETNAM_OFFSET_MS);
  return new Date(
    Date.UTC(
      vietnamTime.getUTCFullYear(),
      vietnamTime.getUTCMonth(),
      vietnamTime.getUTCDate(),
    ) - VIETNAM_OFFSET_MS,
  );
}

function addUtcDays(value: Date, days: number) {
  return new Date(value.getTime() + days * DAY_MS);
}

function countRowsInRange(
  rows: Array<{ createdAt: Date }>,
  start: Date,
  end: Date,
) {
  return rows.filter(({ createdAt }) => createdAt >= start && createdAt < end)
    .length;
}

function growthPercent(current: number, previous: number): number | null {
  if (previous === 0) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

function vietnamDateKey(value: Date) {
  return new Date(value.getTime() + VIETNAM_OFFSET_MS)
    .toISOString()
    .slice(0, 10);
}

function buildDailyGrowth(
  start: Date,
  periodDays: number,
  userRows: Array<{ createdAt: Date }>,
  tournamentRows: Array<{ createdAt: Date }>,
) {
  const userCounts = countRowsByDay(userRows);
  const tournamentCounts = countRowsByDay(tournamentRows);
  return Array.from({ length: periodDays }, (_, index) => {
    const date = vietnamDateKey(addUtcDays(start, index));
    return {
      date,
      newUsers: userCounts.get(date) ?? 0,
      newTournaments: tournamentCounts.get(date) ?? 0,
    };
  });
}

function countRowsByDay(rows: Array<{ createdAt: Date }>) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const key = vietnamDateKey(row.createdAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function aggregateTopGames(
  rows: Array<{
    gameId: string;
    customGameName: string | null;
    _count: { _all: number };
  }>,
  gameById: Map<string, { id: string; code: string; name: string }>,
) {
  const totals = new Map<
    string,
    {
      gameId: string;
      gameCode: string;
      displayGameName: string;
      tournamentCount: number;
    }
  >();

  for (const row of rows) {
    const game = gameById.get(row.gameId);
    const customName = row.customGameName?.trim();
    const displayGameName = customName || game?.name || 'Unknown game';
    const key = customName
      ? `custom:${customName.toLowerCase()}`
      : row.gameId;
    const current = totals.get(key);
    totals.set(key, {
      gameId: customName ? key : row.gameId,
      gameCode: game?.code ?? 'CUSTOM',
      displayGameName: current?.displayGameName ?? displayGameName,
      tournamentCount: (current?.tournamentCount ?? 0) + row._count._all,
    });
  }

  return [...totals.values()]
    .sort((left, right) => right.tournamentCount - left.tournamentCount)
    .slice(0, 5);
}

@Injectable()
export class BannedKeywordService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly contentFilter: ContentFilterService,
  ) {}
  list() {
    return this.prisma.bannedKeyword.findMany({
      orderBy: [{ category: 'asc' }, { keyword: 'asc' }],
    });
  }
  async create(dto: CreateBannedKeywordDto) {
    const result = await this.prisma.bannedKeyword.create({
      data: { keyword: dto.keyword.trim(), category: dto.category },
    });
    await this.contentFilter.refresh();
    return result;
  }
  async update(id: string, dto: UpdateBannedKeywordDto) {
    if (dto.keyword === undefined && dto.category === undefined)
      throw new BadRequestException('At least one field must be provided');
    const current = await this.prisma.bannedKeyword.findUnique({
      where: { id },
    });
    if (!current) throw new NotFoundException('Banned keyword not found');
    const keyword = dto.keyword?.trim();
    if (dto.keyword !== undefined && !keyword)
      throw new BadRequestException('Keyword must not be blank');
    if (keyword) {
      const duplicate = await this.prisma.bannedKeyword.findFirst({
        where: {
          id: { not: id },
          keyword: { equals: keyword, mode: Prisma.QueryMode.insensitive },
        },
        select: { id: true },
      });
      if (duplicate)
        throw new BadRequestException('Banned keyword already exists');
    }
    const result = await this.prisma.bannedKeyword.update({
      where: { id },
      data: {
        ...(keyword !== undefined ? { keyword } : {}),
        ...(dto.category !== undefined ? { category: dto.category } : {}),
      },
    });
    await this.contentFilter.refresh();
    return result;
  }
  async remove(id: string) {
    const keyword = await this.prisma.bannedKeyword.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!keyword) throw new NotFoundException('Banned keyword not found');
    await this.prisma.bannedKeyword.delete({ where: { id } });
    await this.contentFilter.refresh();
    return { message: 'Banned keyword deleted', id };
  }
}
