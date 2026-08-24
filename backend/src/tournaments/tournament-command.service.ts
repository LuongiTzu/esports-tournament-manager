import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MatchStatus,
  ModerationStatus,
  Prisma,
  RoundStatus,
  TournamentMode,
  TournamentStatus,
  Visibility,
} from '@prisma/client';
import { RoundSettingsService } from '../brackets/round-settings.service';
import { ApplicationErrorCode } from '../common/errors/application-error-code';
import { ContentFilterService } from '../common/services/content-filter.service';
import { GAME_CATALOG_NAMES } from '../games/game-catalog';
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
import { TOURNAMENT_GAME_SELECT } from './tournament-prisma.select';

const DELETABLE_TOURNAMENT_STATUSES: TournamentStatus[] = [
  TournamentStatus.DRAFT,
  TournamentStatus.REGISTRATION,
  TournamentStatus.CANCELLED,
];

@Injectable()
export class TournamentCommandService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly roundSettingsService: RoundSettingsService,
    private readonly contentFilter: ContentFilterService,
    private readonly lifecyclePolicy: TournamentLifecyclePolicy,
  ) {}

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
          game: { select: TOURNAMENT_GAME_SELECT },
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

  async update(tournamentId: string, dto: UpdateTournamentDto) {
    const current = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { game: { select: TOURNAMENT_GAME_SELECT } },
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
        select: TOURNAMENT_GAME_SELECT,
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
        game: { select: TOURNAMENT_GAME_SELECT },
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
