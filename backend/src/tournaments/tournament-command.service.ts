import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MatchStatus,
  ModerationStatus,
  NotificationType,
  Prisma,
  RoundStatus,
  TournamentMode,
  TournamentStatus,
  Visibility,
} from '@prisma/client';
import { RoundSettingsService } from '../brackets/round-settings.service';
import { ApplicationErrorCode } from '../common/errors/application-error-code';
import { ContentFilterService } from '../common/services/content-filter.service';
import { GAME_CATALOG_CODES } from '../games/game-catalog';
import { PrismaService } from '../prisma/prisma.service';
import {
  CreateRoundDto,
  CreateTournamentDto,
} from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import {
  InvalidTournamentStatusTransitionError,
  TournamentLifecyclePolicy,
} from './domain/tournament-lifecycle.policy';
import {
  TournamentGameSizeRules,
  TournamentTeamSizePolicy,
  TournamentTeamSizeRuleError,
} from './domain/tournament-team-size.policy';
import { TOURNAMENT_GAME_SELECT } from './tournament-prisma.select';
import { withTournamentGameDisplayName } from './domain/tournament-game-display';
import {
  NOTIFICATION_PUBLISHER,
  NOOP_NOTIFICATION_PUBLISHER,
  NotificationPublisher,
} from '../common/ports/notification-publisher';

const DELETABLE_TOURNAMENT_STATUSES: TournamentStatus[] = [
  TournamentStatus.DRAFT,
  TournamentStatus.REGISTRATION,
  TournamentStatus.CANCELLED,
];
const CUSTOM_GAME_CODE = 'CUSTOM';

@Injectable()
export class TournamentCommandService {
  private readonly teamSizePolicy = new TournamentTeamSizePolicy();
  private readonly logger = new Logger(TournamentCommandService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly roundSettingsService: RoundSettingsService,
    private readonly contentFilter: ContentFilterService,
    private readonly lifecyclePolicy: TournamentLifecyclePolicy,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notifications: NotificationPublisher = NOOP_NOTIFICATION_PUBLISHER,
  ) {}

  async create(userId: string, dto: CreateTournamentDto) {
    // 1. Kiểm tra game tồn tại
    const game = await this.prisma.game.findFirst({
      where: { id: dto.gameId, code: { in: GAME_CATALOG_CODES } },
    });
    if (!game) {
      throw new BadRequestException('Game không tồn tại');
    }

    const minTeamSize = this.resolveTeamSize(game, dto.teamSize);
    const maxTeamSize = this.resolveMaxTeamSize(
      game,
      minTeamSize,
      dto.maxTeamSize,
    );
    const customGameName = this.resolveCustomGameName(
      game.code,
      dto.customGameName,
    );

    // 2. Lọc từ khóa cấm (UC-U19)
    this.validateContent(dto.name, dto.description, dto.rules);

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
          customGameName,
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
          game: { select: TOURNAMENT_GAME_SELECT },
          rounds: { orderBy: { orderIndex: 'asc' } },
          _count: { select: { teams: true } },
        },
      });
    });
    return created && Array.isArray(created.rounds)
      ? withTournamentGameDisplayName({
          ...created,
          rounds: created.rounds.map((round) => ({
            ...round,
            settings: this.roundSettingsService.getEffectiveSettings(
              round.format,
              round.settings,
            ),
          })),
        })
      : created;
  }

  async update(tournamentId: string, dto: UpdateTournamentDto) {
    const current = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { game: { select: TOURNAMENT_GAME_SELECT } },
    });

    if (!current) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    // Đổi game → giới hạn đội hình phải khớp game mới
    let game = current.game;
    if (dto.gameId && dto.gameId !== current.gameId) {
      const newGame = await this.prisma.game.findFirst({
        where: { id: dto.gameId, code: { in: GAME_CATALOG_CODES } },
        select: TOURNAMENT_GAME_SELECT,
      });
      if (!newGame) {
        throw new BadRequestException('Game không tồn tại');
      }
      game = newGame;
    }

    const gameChanged = game.id !== current.gameId;
    const teamSizeChanged = dto.teamSize !== undefined;
    const minTeamSize =
      gameChanged || teamSizeChanged
        ? this.resolveTeamSize(game, dto.teamSize)
        : current.minTeamSize;
    const maxTeamSize = gameChanged
      ? this.resolveMaxTeamSize(game, minTeamSize, dto.maxTeamSize)
      : teamSizeChanged || dto.maxTeamSize !== undefined
        ? this.validateMaxTeamSize(
            game,
            minTeamSize,
            dto.maxTeamSize ?? current.maxTeamSize,
          )
        : current.maxTeamSize;
    const customGameName = this.resolveCustomGameName(
      game.code,
      dto.customGameName,
      gameChanged ? undefined : current.customGameName,
    );

    // Lọc từ khóa cấm nếu có thay đổi name/description
    if (dto.name || dto.description || dto.rules) {
      this.validateContent(dto.name, dto.description, dto.rules);
    }

    if (dto.status !== undefined) {
      try {
        this.lifecyclePolicy.assertCanTransition(current.status, dto.status);
      } catch (error) {
        if (error instanceof InvalidTournamentStatusTransitionError) {
          throw new BadRequestException({
            message: error.message,
            code: ApplicationErrorCode.INVALID_TOURNAMENT_STATUS_TRANSITION,
          });
        }
        throw error;
      }
    }

    const merged = { ...current, ...stripUndefined(dto) };
    this.validateMergedSettings(merged);

    const updated = await this.prisma.tournament.update({
      where: { id: tournamentId },
      data: {
        name: dto.name,
        description: dto.description,
        customGameName:
          gameChanged || dto.customGameName !== undefined
            ? customGameName
            : undefined,
        rules: dto.rules,
        bannerUrl: dto.bannerUrl,
        visibility: dto.visibility,
        status: dto.status,
        mode: dto.mode,
        location: dto.location,
        registrationOpen: dto.registrationOpen,
        maxTeams: dto.maxTeams,
        minTeamSize: gameChanged || teamSizeChanged ? minTeamSize : undefined,
        maxTeamSize:
          gameChanged || teamSizeChanged || dto.maxTeamSize !== undefined
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
        game: { select: TOURNAMENT_GAME_SELECT },
        rounds: { orderBy: { orderIndex: 'asc' } },
      },
    });

    if (dto.status !== undefined && dto.status !== current.status) {
      try {
        await this.notifications.createForTournamentEvent({
          tournamentId,
          type: NotificationType.TOURNAMENT_STATUS,
          content: 'Tournament status updated',
          data: {
            kind: 'TOURNAMENT_STATUS',
            previousStatus: current.status,
            status: dto.status,
          },
          sourceKey: `tournament:${tournamentId}:status:${current.status}:${dto.status}`,
        });
      } catch (error) {
        this.logger.error(
          `Tournament update committed but notification persistence failed for ${tournamentId}`,
          error instanceof Error ? error.stack : String(error),
        );
      }
    }

    return withTournamentGameDisplayName({
      ...updated,
      rounds: updated.rounds.map((round) => ({
        ...round,
        settings: this.roundSettingsService.getEffectiveSettings(
          round.format,
          round.settings,
        ),
      })),
    });
  }

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

  async addRound(tournamentId: string, dto: CreateRoundDto) {
    // Chuẩn hóa settings theo format (điền defaults + validate)
    const normalizedSettings =
      await this.roundSettingsService.normalizeForFormat(
        dto.format,
        dto.settings,
      );

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "tournaments" WHERE "id" = ${tournamentId} FOR UPDATE`,
      );
      const tournament = await tx.tournament.findUnique({
        where: { id: tournamentId },
        select: { id: true },
      });
      if (!tournament) {
        throw new NotFoundException('Không tìm thấy giải đấu');
      }
      const lastRound = await tx.round.findFirst({
        where: { tournamentId },
        orderBy: { orderIndex: 'desc' },
        select: { orderIndex: true },
      });
      return tx.round.create({
        data: {
          name: dto.name,
          format: dto.format,
          bestOf: dto.bestOf ?? 1,
          settings: normalizedSettings as unknown as Prisma.InputJsonValue,
          orderIndex: (lastRound?.orderIndex ?? 0) + 1,
          tournamentId,
        },
      });
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

  private resolveTeamSize(
    game: TournamentGameSizeRules,
    requestedTeamSize?: number,
  ): number {
    return this.mapTeamSizeRuleError(() =>
      this.teamSizePolicy.resolveTeamSize(game, requestedTeamSize),
    );
  }

  private resolveMaxTeamSize(
    game: TournamentGameSizeRules,
    teamSize: number,
    requestedMaxTeamSize?: number,
  ): number {
    return this.mapTeamSizeRuleError(() =>
      this.teamSizePolicy.resolveMaxTeamSize(
        game,
        teamSize,
        requestedMaxTeamSize,
      ),
    );
  }

  private validateMaxTeamSize(
    game: TournamentGameSizeRules,
    teamSize: number,
    maxTeamSize: number,
  ): number {
    return this.mapTeamSizeRuleError(() =>
      this.teamSizePolicy.validateMaxTeamSize(game, teamSize, maxTeamSize),
    );
  }

  private mapTeamSizeRuleError<T>(operation: () => T): T {
    try {
      return operation();
    } catch (error) {
      if (error instanceof TournamentTeamSizeRuleError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private resolveCustomGameName(
    gameCode: string,
    requestedName: string | null | undefined,
    currentName?: string | null,
  ): string | null {
    if (gameCode !== CUSTOM_GAME_CODE) {
      if (requestedName !== undefined) {
        throw new BadRequestException(
          'customGameName chỉ được dùng với Custom Game',
        );
      }
      return null;
    }

    const customGameName =
      requestedName === undefined ? currentName : requestedName;
    if (
      typeof customGameName !== 'string' ||
      customGameName.trim().length === 0
    ) {
      throw new BadRequestException(
        'customGameName là bắt buộc khi chọn Custom Game',
      );
    }
    return requestedName === undefined
      ? customGameName
      : this.contentFilter.validate(customGameName);
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
