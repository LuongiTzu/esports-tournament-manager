import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ModerationStatus, Prisma, ReportStatus } from '@prisma/client';
import { ContentFilterService } from '../common/services/content-filter.service';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateBannedKeywordDto,
  UpdateBannedKeywordDto,
} from './dto/banned-keyword.dto';

@Injectable()
export class AdminDashboardQueryService {
  constructor(private readonly prisma: PrismaService) {}
  async stats() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const [
      totalTournaments,
      totalUsers,
      reportedTournamentRows,
      lockedTournaments,
      lockedAccounts,
      tournamentsLast7Days,
    ] = await Promise.all([
      this.prisma.tournament.count(),
      this.prisma.user.count(),
      this.prisma.report.groupBy({
        by: ['tournamentId'],
        where: { status: ReportStatus.PENDING },
      }),
      this.prisma.tournament.count({
        where: { moderationStatus: ModerationStatus.HIDDEN_BY_ADMIN },
      }),
      this.prisma.user.count({ where: { isLocked: true } }),
      this.prisma.tournament.count({
        where: { createdAt: { gte: sevenDaysAgo } },
      }),
    ]);
    return {
      totalTournaments,
      totalUsers,
      tournamentsBeingReported: reportedTournamentRows.length,
      lockedTournaments,
      lockedAccounts,
      tournamentsCreatedLast7Days: tournamentsLast7Days,
    };
  }
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
