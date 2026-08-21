import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MatchStatus,
  Prisma,
  ModerationStatus,
  RoundStatus,
  Visibility,
  TournamentMode,
  TournamentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateTournamentDto,
  CreateRoundDto,
} from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { RoundSettingsService } from '../brackets/round-settings.service';
import { StandingsService } from '../brackets/standings.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import { GAME_CATALOG_NAMES } from '../games/game-catalog';

/** Field của Game cần trả kèm giải đấu — FE dùng để biết giới hạn đội hình */
const GAME_SELECT = {
  id: true,
  name: true,
  iconUrl: true,
  genre: true,
  positions: true,
  positionMode: true,
  defaultTeamSize: true,
  minTeamSize: true,
  maxTeamSize: true,
} as const;

const PUBLIC_TEAM_SELECT = {
  id: true,
  name: true,
  shortName: true,
  logoUrl: true,
  seed: true,
} as const;

const DELETABLE_TOURNAMENT_STATUSES: TournamentStatus[] = [
  TournamentStatus.DRAFT,
  TournamentStatus.REGISTRATION,
  TournamentStatus.CANCELLED,
];

@Injectable()
export class TournamentsService {
  constructor(
    private prisma: PrismaService,
    private roundSettingsService: RoundSettingsService,
    private standingsService: StandingsService,
    private readonly contentFilter: ContentFilterService,
  ) {}

  /**
   * Tạo giải đấu mới (UC-U04) — Instant Publishing
   * - Tự sinh slug unique từ tên giải
   * - Lọc từ khóa cấm (UC-U19) trên name/description
   * - Tạo kèm các Round nếu có
   */
  async create(userId: string, dto: CreateTournamentDto) {
    // 1. Kiểm tra game tồn tại
    const game = await this.prisma.game.findFirst({
      where: { id: dto.gameId, name: { in: GAME_CATALOG_NAMES } },
    });
    if (!game) {
      throw new BadRequestException('Game không tồn tại');
    }

    // 2. Lọc từ khóa cấm (UC-U19)
    this.validateContent(dto.name, dto.description, dto.rules);

    // 3. Snapshot đội hình thi đấu chuẩn; BTC chỉ chọn tổng số vị trí cầu thủ.
    const minTeamSize = game.defaultTeamSize;
    const maxTeamSize = dto.maxTeamSize ?? game.maxTeamSize;
    this.validateRosterSettings(minTeamSize, maxTeamSize, game.maxTeamSize);

    // 4. Ràng buộc liên-field — dùng chung 1 hàm với luồng update
    const mode = dto.mode ?? TournamentMode.ONLINE;
    this.validateMergedSettings({
      mode,
      location: dto.location ?? null,
      minAge: dto.minAge ?? null,
      maxAge: dto.maxAge ?? null,
      registrationStartDate: dto.registrationStartDate ?? null,
      registrationDeadline: dto.registrationDeadline ?? null,
      startDate: dto.startDate ?? null,
      endDate: dto.endDate ?? null,
    });

    // 5. Tự sinh slug unique
    const slug = await this.generateUniqueSlug(dto.name);

    // 6. Tạo giải đấu + rounds (transaction)
    const created = await this.prisma.$transaction(async (tx) => {
      const tournament = await tx.tournament.create({
        data: {
          name: dto.name,
          slug,
          description: dto.description,
          rules: dto.rules,
          bannerUrl: dto.bannerUrl,
          visibility: dto.visibility ?? Visibility.PUBLIC,
          moderationStatus: ModerationStatus.ACTIVE, // Instant Publishing
          status: dto.status ?? TournamentStatus.REGISTRATION,
          mode,
          location: dto.location,
          registrationOpen: dto.registrationOpen ?? true,
          maxTeams: dto.maxTeams,
          minTeamSize,
          maxTeamSize,
          minAge: dto.minAge,
          maxAge: dto.maxAge,
          allowedGenders: dto.allowedGenders ?? Prisma.JsonNull,
          registrationStartDate: toDate(dto.registrationStartDate),
          registrationDeadline: toDate(dto.registrationDeadline),
          startDate: toDate(dto.startDate),
          endDate: toDate(dto.endDate),
          autoApproveTeams: dto.autoApproveTeams ?? false,
          requireMemberFullInfo: dto.requireMemberFullInfo ?? true,
          prizePool: dto.prizePool,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
          contactLink: dto.contactLink,
          gameId: dto.gameId,
          organizerId: userId,
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
          game: { select: GAME_SELECT },
          rounds: { orderBy: { orderIndex: 'asc' } },
          _count: { select: { teams: true } },
        },
      });
    });
    return created && Array.isArray(created.rounds)
      ? {
          ...created,
          rounds: created.rounds.map((round) => ({
            ...round,
            settings: this.roundSettingsService.getEffectiveSettings(
              round.format,
              round.settings,
            ),
          })),
        }
      : created;
  }

  /**
   * Danh sách giải đấu Public (UC-G01, UC-G02)
   * - Lọc theo từ khóa (tên giải, tên game)
   * - Lọc theo gameId, status, mode, isVerified
   * - Chỉ hiển thị giải PUBLIC + ACTIVE
   * - Giải đã Verified được ưu tiên lên đầu (UC-A06)
   */
  async findAllPublic(query: {
    search?: string;
    gameId?: string;
    status?: TournamentStatus;
    mode?: TournamentMode;
    isVerified?: string | boolean;
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

    if (query.status) {
      if (!(query.status in TournamentStatus)) {
        throw new BadRequestException('Trạng thái lọc không hợp lệ');
      }
      where.status = query.status;
    }

    if (query.mode) {
      if (!(query.mode in TournamentMode)) {
        throw new BadRequestException('Hình thức tổ chức lọc không hợp lệ');
      }
      where.mode = query.mode;
    }

    if (query.isVerified !== undefined) {
      where.isVerified =
        query.isVerified === true || query.isVerified === 'true';
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
        orderBy: [
          { isVerified: 'desc' },
          { startDate: 'asc' },
          { createdAt: 'desc' },
        ],
        include: {
          game: { select: GAME_SELECT },
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
  async findBySlug(slug: string, userId?: string, userRole?: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      include: {
        game: {
          select: GAME_SELECT,
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
      !(await this.canViewPrivate(
        tournament.id,
        tournament.organizerId,
        userId,
        userRole,
      ))
    ) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    // Giải bị Admin ẩn: chỉ chủ giải xem được
    if (
      tournament.moderationStatus === ModerationStatus.HIDDEN_BY_ADMIN &&
      tournament.organizerId !== userId &&
      userRole !== 'ADMIN'
    ) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    return {
      ...tournament,
      rounds: tournament.rounds.map((round) => ({
        ...round,
        settings: this.roundSettingsService.getEffectiveSettings(
          round.format,
          round.settings,
        ),
      })),
    };
  }

  /**
   * Cập nhật giải đấu (UC-U09) — chỉ BTC
   *
   * PATCH gửi dữ liệu một phần nên các ràng buộc liên-field (min<=max, thứ tự mốc
   * thời gian, địa điểm bắt buộc khi Offline) phải kiểm tra trên trạng thái ĐÃ MERGE
   * giữa dto và bản ghi hiện tại — decorator ở DTO chỉ thấy được payload gửi lên.
   */
  async update(tournamentId: string, dto: UpdateTournamentDto) {
    const current = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { game: { select: GAME_SELECT } },
    });

    if (!current) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    // Lọc từ khóa cấm nếu có thay đổi name/description
    if (dto.name || dto.description || dto.rules) {
      this.validateContent(dto.name, dto.description, dto.rules);
    }

    // Đổi game → giới hạn đội hình phải khớp game mới
    let game = current.game;
    if (dto.gameId && dto.gameId !== current.gameId) {
      const newGame = await this.prisma.game.findFirst({
        where: { id: dto.gameId, name: { in: GAME_CATALOG_NAMES } },
        select: GAME_SELECT,
      });
      if (!newGame) {
        throw new BadRequestException('Game không tồn tại');
      }
      game = newGame;
    }

    const gameChanged = game.id !== current.gameId;
    const minTeamSize = gameChanged
      ? game.defaultTeamSize
      : current.minTeamSize;
    const maxTeamSize = gameChanged
      ? (dto.maxTeamSize ?? game.maxTeamSize)
      : (dto.maxTeamSize ?? current.maxTeamSize);

    if (gameChanged || dto.maxTeamSize !== undefined) {
      this.validateRosterSettings(minTeamSize, maxTeamSize, game.maxTeamSize);
    }

    const merged = { ...current, ...stripUndefined(dto) };
    this.validateMergedSettings(merged);

    const updated = await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        name: dto.name,
        description: dto.description,
        rules: dto.rules,
        bannerUrl: dto.bannerUrl,
        visibility: dto.visibility,
        status: dto.status,
        mode: dto.mode,
        location: dto.location,
        registrationOpen: dto.registrationOpen,
        maxTeams: dto.maxTeams,
        minTeamSize: gameChanged ? minTeamSize : undefined,
        maxTeamSize:
          gameChanged || dto.maxTeamSize !== undefined
            ? maxTeamSize
            : undefined,
        minAge: dto.minAge,
        maxAge: dto.maxAge,
        allowedGenders: dto.allowedGenders,
        registrationStartDate: toDate(dto.registrationStartDate),
        registrationDeadline: toDate(dto.registrationDeadline),
        startDate: toDate(dto.startDate),
        endDate: toDate(dto.endDate),
        autoApproveTeams: dto.autoApproveTeams,
        requireMemberFullInfo: dto.requireMemberFullInfo,
        prizePool: dto.prizePool,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
        contactLink: dto.contactLink,
        gameId: dto.gameId,
      },
      include: {
        game: { select: GAME_SELECT },
        rounds: { orderBy: { orderIndex: 'asc' } },
      },
    });

    return {
      ...updated,
      rounds: updated.rounds.map((round) => ({
        ...round,
        settings: this.roundSettingsService.getEffectiveSettings(
          round.format,
          round.settings,
        ),
      })),
    };
  }

  /**
   * Xóa giải đấu (UC-U10) — chỉ BTC
   */
  async remove(tournamentId: string) {
    return this.prisma.$transaction(
      async (tx) => {
        const tournament = await tx.tournament.findUnique({
          where: { id: tournamentId },
          select: { id: true, status: true, startDate: true },
        });
        if (!tournament) {
          throw new NotFoundException('Không tìm thấy giải đấu');
        }

        if (!DELETABLE_TOURNAMENT_STATUSES.includes(tournament.status)) {
          throw new BadRequestException(
            'Không thể xóa giải đấu đang diễn ra hoặc đã kết thúc',
          );
        }
        if (tournament.startDate && tournament.startDate <= new Date()) {
          throw new BadRequestException(
            'Không thể xóa giải đấu đã đến thời điểm bắt đầu',
          );
        }

        const [startedRounds, startedMatches] = await Promise.all([
          tx.round.count({
            where: {
              tournamentId,
              status: { in: [RoundStatus.ONGOING, RoundStatus.COMPLETED] },
            },
          }),
          tx.match.count({
            where: {
              round: { tournamentId },
              OR: [
                {
                  status: {
                    in: [MatchStatus.ONGOING, MatchStatus.COMPLETED],
                  },
                },
                { playedAt: { not: null } },
                { scoreA: { gt: 0 } },
                { scoreB: { gt: 0 } },
                { scores: { some: {} } },
              ],
            },
          }),
        ]);
        if (startedRounds > 0 || startedMatches > 0) {
          throw new BadRequestException(
            'Không thể xóa giải đấu đã có vòng hoặc trận đấu bắt đầu',
          );
        }

        await tx.tournament.delete({ where: { id: tournamentId } });
        return { message: 'Đã xóa giải đấu thành công' };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  /**
   * Danh sách giải của tôi (UC-U18)
   * - tab = 'organized': giải tôi tạo
   * - tab = 'joined': giải tôi tham gia (có đội đăng ký)
   */
  async findMyTournaments(
    userId: string,
    tab: 'organized' | 'joined',
    userRole?: string,
  ) {
    if (tab !== 'organized' && tab !== 'joined') {
      throw new BadRequestException('Tab must be organized or joined');
    }
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
      where: {
        id: { in: tournamentIds },
        moderationStatus:
          userRole === 'ADMIN' ? undefined : ModerationStatus.ACTIVE,
      },
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

    // Chuẩn hóa settings theo format (điền defaults + validate)
    const normalizedSettings =
      await this.roundSettingsService.normalizeForFormat(
        dto.format,
        dto.settings,
      );

    return this.prisma.round.create({
      data: {
        name: dto.name,
        format: dto.format,
        bestOf: dto.bestOf ?? 1,
        settings: normalizedSettings as unknown as Prisma.InputJsonValue,
        orderIndex: (lastRound?.orderIndex ?? 0) + 1,
        tournamentId,
      },
    });
  }

  async addRoundBySlug(slug: string, dto: CreateRoundDto) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!tournament) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }
    return this.addRound(tournament.id, dto);
  }

  async getStandings(slug: string, userId?: string, userRole?: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      select: {
        id: true,
        organizerId: true,
        visibility: true,
        moderationStatus: true,
        rounds: {
          select: { id: true, format: true, settings: true },
          orderBy: { orderIndex: 'asc' },
        },
      },
    });
    if (!tournament) throw new NotFoundException('Không tìm thấy giải đấu');
    if (
      tournament.moderationStatus === ModerationStatus.HIDDEN_BY_ADMIN &&
      tournament.organizerId !== userId &&
      userRole !== 'ADMIN'
    ) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }
    if (
      tournament.visibility === Visibility.PRIVATE &&
      !(await this.canViewPrivate(
        tournament.id,
        tournament.organizerId,
        userId,
        userRole,
      ))
    ) {
      throw new NotFoundException('Tournament not found');
    }
    return this.standingsService.forTournament(
      tournament.id,
      tournament.rounds,
    );
  }

  // ─── Private helpers ────────────────────────────────────────

  /**
   * Kiểm tra các ràng buộc liên-field trên trạng thái giải đấu đã merge.
   * Dùng cho luồng PATCH, nơi decorator ở DTO chỉ nhìn thấy payload một phần.
   */
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
                teamA: { select: PUBLIC_TEAM_SELECT },
                teamB: { select: PUBLIC_TEAM_SELECT },
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
                  include: { team: { select: PUBLIC_TEAM_SELECT } },
                },
              },
            },
            matches: {
              orderBy: [{ bracketRound: 'asc' }, { matchNumber: 'asc' }],
              include: {
                teamA: { select: PUBLIC_TEAM_SELECT },
                teamB: { select: PUBLIC_TEAM_SELECT },
                winner: { select: PUBLIC_TEAM_SELECT },
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
          bracketRound: match.bracketRound,
          bracketType: match.bracketType,
          matchNumber: match.matchNumber,
          status: match.status,
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

  private async canViewPrivate(
    tournamentId: string,
    organizerId: string,
    userId?: string,
    userRole?: string,
  ) {
    if (!userId) return false;
    if (userRole === 'ADMIN' || organizerId === userId) return true;
    const team = await this.prisma.team.findFirst({
      where: {
        tournamentId,
        OR: [{ captainId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true },
    });
    return team !== null;
  }

  private validateMergedSettings(t: {
    mode: TournamentMode;
    location: string | null;
    minAge: number | null;
    maxAge: number | null;
    registrationStartDate: Date | string | null;
    registrationDeadline: Date | string | null;
    startDate: Date | string | null;
    endDate: Date | string | null;
  }) {
    if (t.mode !== TournamentMode.ONLINE && !t.location?.trim()) {
      throw new BadRequestException(
        'Giải đấu Offline/Hybrid bắt buộc phải có địa điểm',
      );
    }

    if (t.minAge != null && t.maxAge != null && t.minAge > t.maxAge) {
      throw new BadRequestException(
        'Tuổi tối thiểu không được lớn hơn tuổi tối đa',
      );
    }

    // Thứ tự các mốc thời gian: mở đăng ký → hạn đăng ký → bắt đầu → kết thúc
    const timeline: [string, Date | string | null][] = [
      ['Thời điểm mở đăng ký', t.registrationStartDate],
      ['Hạn chót đăng ký', t.registrationDeadline],
      ['Ngày bắt đầu', t.startDate],
      ['Ngày kết thúc', t.endDate],
    ];
    const marks = timeline
      .filter(([, v]) => v != null)
      .map(([label, v]) => [label, new Date(v!).getTime()] as const);

    for (let i = 1; i < marks.length; i++) {
      if (marks[i][1] < marks[i - 1][1]) {
        throw new BadRequestException(
          `${marks[i][0]} phải sau ${marks[i - 1][0]}`,
        );
      }
    }
  }

  private validateRosterSettings(
    minTeamSize: number,
    maxTeamSize: number,
    gameMaxTeamSize: number,
  ) {
    if (maxTeamSize < minTeamSize) {
      throw new BadRequestException(
        `Số thành viên tối đa (${maxTeamSize}) không được nhỏ hơn đội hình thi đấu mặc định (${minTeamSize})`,
      );
    }

    if (maxTeamSize > gameMaxTeamSize) {
      throw new BadRequestException(
        `Số thành viên tối đa (${maxTeamSize}) vượt quá giới hạn của game (${gameMaxTeamSize})`,
      );
    }
  }

  private validateContent(...values: Array<string | undefined>) {
    for (const value of values) {
      if (value !== undefined) this.contentFilter.validate(value);
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
      const normalizedSettings =
        await this.roundSettingsService.normalizeForFormat(
          rounds[i].format,
          rounds[i].settings,
        );

      await tx.round.create({
        data: {
          name: rounds[i].name,
          format: rounds[i].format,
          bestOf: rounds[i].bestOf ?? 1,
          settings: normalizedSettings as unknown as Prisma.InputJsonValue,
          orderIndex: i + 1,
          tournamentId,
        },
      });
    }
  }
}

// ─── Module helpers ───────────────────────────────────────────

/** Chuỗi ISO → Date. Giữ nguyên undefined để Prisma bỏ qua field khi update. */
function toDate(value?: string | null): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return new Date(value);
}

/** Bỏ các key có giá trị undefined để spread không ghi đè dữ liệu hiện có bằng undefined */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
