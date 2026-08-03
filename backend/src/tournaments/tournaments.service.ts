import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ModerationStatus, Visibility } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTournamentDto,
  CreateRoundDto,
} from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';

@Injectable()
export class TournamentsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tạo giải đấu mới (UC-U04) — Instant Publishing
   * - Tự sinh slug unique từ tên giải
   * - Lọc từ khóa cấm (UC-U19) trên name/description
   * - Tạo kèm các Round nếu có
   */
  async create(userId: string, dto: CreateTournamentDto) {
    // 1. Kiểm tra game tồn tại
    const game = await this.prisma.game.findUnique({
      where: { id: dto.gameId },
    });
    if (!game) {
      throw new BadRequestException('Game không tồn tại');
    }

    // 2. Lọc từ khóa cấm (UC-U19)
    await this.checkBannedKeywords(dto.name, dto.description);

    // 3. Tự sinh slug unique
    const slug = await this.generateUniqueSlug(dto.name);

    // 4. Tạo giải đấu + rounds (transaction)
    return this.prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          rules: dto.rules,
          visibility: dto.visibility ?? Visibility.PUBLIC,
          moderationStatus: ModerationStatus.ACTIVE, // Instant Publishing
          registrationOpen: dto.registrationOpen ?? true,
          maxTeams: dto.maxTeams,
          startDate: dto.startDate ? new Date(dto.startDate) : null,
          endDate: dto.endDate ? new Date(dto.endDate) : null,
          gameId: dto.gameId,
          organizerId: userId,
        },
        include: {
          game: { select: { id: true, name: true, teamSize: true } },
          rounds: true,
        },
      });

      // Tạo các Round nếu có
      if (dto.rounds?.length) {
        await this.createRounds(tx, tournament.id, dto.rounds);
      }

      // Lấy lại giải kèm rounds đã tạo
      return tx.tournament.findUnique({
        where: { id: tournament.id },
        include: {
          game: { select: { id: true, name: true, teamSize: true } },
          rounds: { orderBy: { orderIndex: 'asc' } },
          _count: { select: { teams: true } },
        },
      });
    });
  }

  /**
   * Danh sách giải đấu Public (UC-G01, UC-G02)
   * - Lọc theo từ khóa (tên giải, tên game)
   * - Lọc theo gameId
   * - Chỉ hiển thị giải PUBLIC + ACTIVE
   */
  async findAllPublic(query: {
    search?: string;
    gameId?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(query.limit) || 20));
    const skip = (page - 1) * limit;

    const where: Prisma.TournamentWhereInput = {
      visibility: Visibility.PUBLIC,
      moderationStatus: ModerationStatus.ACTIVE,
    };

    if (query.gameId) {
      where.gameId = query.gameId;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { game: { name: { contains: query.search, mode: 'insensitive' } } },
      ];
    }

    const [data, total] = await Promise.all([
      this.prisma.tournament.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          game: { select: { id: true, name: true, iconUrl: true } },
          _count: { select: { teams: true } },
        },
      }),
      this.prisma.tournament.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Chi tiết giải đấu theo slug (UC-G03, UC-G04)
   * - Public: chỉ xem được giải PUBLIC + ACTIVE
   * - Chủ giải: xem được cả giải PRIVATE
   */
  async findBySlug(slug: string, userId?: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      include: {
        game: {
          select: { id: true, name: true, iconUrl: true, teamSize: true },
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
        _count: { select: { teams: true, comments: true } },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    // Kiểm tra quyền xem: giải PRIVATE chỉ chủ giải xem được
    if (
      tournament.visibility === Visibility.PRIVATE &&
      tournament.organizerId !== userId
    ) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    // Giải bị Admin ẩn: chỉ chủ giải xem được
    if (
      tournament.moderationStatus === ModerationStatus.HIDDEN_BY_ADMIN &&
      tournament.organizerId !== userId
    ) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    return tournament;
  }

  /**
   * Cập nhật giải đấu (UC-U09) — chỉ BTC
   */
  async update(tournamentId: string, dto: UpdateTournamentDto) {
    // Lọc từ khóa cấm nếu có thay đổi name/description
    if (dto.name || dto.description) {
      await this.checkBannedKeywords(dto.name, dto.description);
    }

    return this.prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        name: dto.name,
        description: dto.description,
        rules: dto.rules,
        visibility: dto.visibility,
        registrationOpen: dto.registrationOpen,
        maxTeams: dto.maxTeams,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        endDate: dto.endDate ? new Date(dto.endDate) : undefined,
        gameId: dto.gameId,
      },
      include: {
        game: { select: { id: true, name: true } },
        rounds: { orderBy: { orderIndex: 'asc' } },
      },
    });
  }

  /**
   * Xóa giải đấu (UC-U10) — chỉ BTC
   */
  async remove(tournamentId: string) {
    await this.prisma.tournament.delete({
      where: { id: tournamentId },
    });
    return { message: 'Đã xóa giải đấu thành công' };
  }

  /**
   * Danh sách giải của tôi (UC-U18)
   * - tab = 'organized': giải tôi tạo
   * - tab = 'joined': giải tôi tham gia (có đội đăng ký)
   */
  async findMyTournaments(userId: string, tab: 'organized' | 'joined') {
    if (tab === 'organized') {
      return this.prisma.tournament.findMany({
        where: { organizerId: userId },
        orderBy: { createdAt: 'desc' },
        include: {
          game: { select: { id: true, name: true, iconUrl: true } },
          _count: { select: { teams: true } },
        },
      });
    }

    // joined: giải có đội mà user là captain hoặc thành viên
    const teams = await this.prisma.team.findMany({
      where: {
        OR: [{ captainId: userId }, { members: { some: { userId } } }],
      },
      select: { tournamentId: true },
    });

    const tournamentIds = [...new Set(teams.map((t) => t.tournamentId))];

    return this.prisma.tournament.findMany({
      where: { id: { in: tournamentIds } },
      orderBy: { createdAt: 'desc' },
      include: {
        game: { select: { id: true, name: true, iconUrl: true } },
        _count: { select: { teams: true } },
      },
    });
  }

  /**
   * Thêm Round vào giải (UC-U05) — chỉ BTC
   */
  async addRound(tournamentId: string, dto: CreateRoundDto) {
    const lastRound = await this.prisma.round.findFirst({
      where: { tournamentId },
      orderBy: { orderIndex: 'desc' },
      select: { orderIndex: true },
    });

    return this.prisma.round.create({
      data: {
        name: dto.name,
        format: dto.format,
        settings: (dto.settings as Prisma.InputJsonValue) ?? Prisma.JsonNull,
        orderIndex: (lastRound?.orderIndex ?? 0) + 1,
        tournamentId,
      },
    });
  }

  // ─── Private helpers ────────────────────────────────────────

  /** Lọc từ khóa cấm (UC-U19) — kiểm tra name/description chứa keyword cấm */
  private async checkBannedKeywords(name?: string, description?: string) {
    const bannedKeywords = await this.prisma.bannedKeyword.findMany({
      select: { keyword: true },
    });

    const content = `${name ?? ''} ${description ?? ''}`.toLowerCase();
    const found = bannedKeywords.find((kw) =>
      content.includes(kw.keyword.toLowerCase()),
    );

    if (found) {
      throw new BadRequestException(
        `Nội dung chứa từ khóa bị cấm: "${found.keyword}"`,
      );
    }
  }

  /** Tự sinh slug unique từ tên giải */
  private async generateUniqueSlug(name: string): Promise<string> {
    const base = name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // bỏ dấu tiếng Việt
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50);

    const random = Math.random().toString(36).slice(2, 6);
    const slug = `${base || 'tournament'}-${random}`;

    // Kiểm tra unique, nếu trùng thì thử lại
    const existing = await this.prisma.tournament.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing) {
      return this.generateUniqueSlug(name);
    }

    return slug;
  }

  /** Tạo nhiều Round cùng lúc (dùng trong transaction) */
  private async createRounds(
    tx: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0],
    tournamentId: string,
    rounds: CreateRoundDto[],
  ) {
    for (let i = 0; i < rounds.length; i++) {
      await tx.round.create({
        data: {
          name: rounds[i].name,
          format: rounds[i].format,
          settings:
            (rounds[i].settings as Prisma.InputJsonValue) ?? Prisma.JsonNull,
          orderIndex: i + 1,
          tournamentId,
        },
      });
    }
  }
}
