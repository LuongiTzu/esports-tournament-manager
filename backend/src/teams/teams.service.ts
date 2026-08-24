import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import {
  MemberRole,
  MatchOutcome,
  MatchStatus,
  NotificationType,
  Prisma,
  RegistrationStatus,
  TournamentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { RegisterTeamDto, TeamMemberInputDto } from './dto/register-team.dto';
import {
  UpdateTeamDto,
  UpdateTeamMemberDto,
  UpdateTeamStatusDto,
} from './dto/update-team.dto';
import { RegistrationValidatorService } from './registration-validator.service';
import { TournamentEventsService } from '../tournaments/tournament-events.service';
import { NotificationService } from '../notifications/notification.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import { RegistrationMemberInput } from './types/registration-member-input';

/** Field roster mà người ngoài (không phải BTC/thành viên đội) được xem */
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
export class TeamsService {
  constructor(
    private prisma: PrismaService,
    private validator: RegistrationValidatorService,
    private readonly notifications: NotificationService,
    private readonly contentFilter: ContentFilterService,
    @Optional() private readonly events?: TournamentEventsService,
  ) {}

  /**
   * Đăng ký đội tham gia giải (UC-U11) — người dùng tự đăng ký
   * - Người đăng ký trở thành captain
   * - Dùng lại đúng bộ điều kiện của `getRegistrationForm` để FE và BE không lệch nhau
   * - `autoApproveTeams` bỏ qua bước chờ duyệt
   */
  async register(userId: string, slug: string, dto: RegisterTeamDto) {
    const tournament = await this.loadTournamentForRegistration(slug);

    const reason = await this.resolveBlockingReason(tournament, userId);
    if (reason) {
      throw new BadRequestException(reason);
    }

    return this.createTeam(tournament, userId, dto, {
      status: tournament.autoApproveTeams
        ? RegistrationStatus.APPROVED
        : RegistrationStatus.PENDING,
      notifyOrganizer: true,
    });
  }

  /**
   * BTC thêm đội thủ công (UC-U06) — dùng lại đúng DTO + validator của luồng
   * đăng ký, chỉ khác là đội vào thẳng trạng thái APPROVED.
   */
  async addManual(organizerId: string, slug: string, dto: RegisterTeamDto) {
    const tournament = await this.loadTournamentForRegistration(slug);

    if (tournament.maxTeams) {
      const occupied = await this.countOccupiedSlots(tournament.id);
      if (occupied >= tournament.maxTeams) {
        throw new BadRequestException('Giải đấu đã đủ số đội tham gia');
      }
    }

    return this.createTeam(tournament, organizerId, dto, {
      status: RegistrationStatus.APPROVED,
      notifyOrganizer: false,
    });
  }

  /**
   * Danh sách đội của 1 giải (UC-G05)
   * - Khách/người thường chỉ thấy đội APPROVED
   * - BTC thấy cả PENDING/REJECTED và lọc được theo `status`
   */
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

  /**
   * Chi tiết đội kèm roster (UC-G06).
   * Email / SĐT / ngày sinh của thành viên chỉ hiện với BTC, đội trưởng và
   * chính thành viên trong đội — người ngoài chỉ thấy hồ sơ thi đấu.
   */
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

  /** Danh sách đội của tôi kèm trạng thái từng giải (UC-U12) */
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

  /**
   * Sửa hồ sơ đội (UC-U12) — đội trưởng hoặc BTC.
   * Roster không sửa ở đây, dùng nhóm endpoint `/teams/:id/members`.
   */
  async update(teamId: string, dto: UpdateTeamDto) {
    const team = await this.loadEditableTeam(teamId);

    this.assertContentAllowed(dto.name, dto.description);

    if (dto.name && dto.name !== team.name) {
      await this.assertTeamNameAvailable(team.tournamentId, dto.name, teamId);
    }

    return this.prisma.team.update({
      where: { id: teamId },
      data: {
        name: dto.name,
        shortName: dto.shortName,
        logoUrl: dto.logoUrl,
        description: dto.description,
        contactName: dto.contactName,
        contactEmail: dto.contactEmail,
        contactPhone: dto.contactPhone,
      },
      include: {
        captain: { select: CAPTAIN_SELECT },
        members: { orderBy: { orderIndex: 'asc' } },
      },
    });
  }

  /** Thêm thành viên vào roster — validate lại toàn đội sau khi thêm */
  async addMember(teamId: string, dto: TeamMemberInputDto) {
    const team = await this.loadEditableTeam(teamId);
    const current = await this.loadRosterAsInput(teamId);

    await this.validateRoster(team.tournamentId, [...current, dto], teamId);

    await this.prisma.teamMember.create({
      data: {
        teamId,
        realName: dto.realName,
        ign: dto.ign,
        inGameId: dto.inGameId,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : null,
        gender: dto.gender,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        position: dto.position,
        memberRole: dto.memberRole ?? MemberRole.PLAYER,
        avatarUrl: dto.avatarUrl,
        orderIndex: dto.orderIndex ?? current.length,
      },
    });

    return this.findOne(teamId, team.captainId);
  }

  /** Sửa 1 thành viên — validate lại toàn đội trên trạng thái đã merge */
  async updateMember(
    teamId: string,
    memberId: string,
    dto: UpdateTeamMemberDto,
  ) {
    const team = await this.loadEditableTeam(teamId);
    const current = await this.loadRosterAsInput(teamId);

    const index = current.findIndex((m) => m.id === memberId);
    if (index === -1) {
      throw new NotFoundException('Không tìm thấy thành viên trong đội này');
    }

    const merged = [...current];
    merged[index] = { ...current[index], ...stripUndefined(dto) };

    await this.validateRoster(team.tournamentId, merged, teamId);

    await this.prisma.teamMember.update({
      where: { id: memberId },
      data: {
        realName: dto.realName,
        ign: dto.ign,
        inGameId: dto.inGameId,
        birthDate: dto.birthDate ? new Date(dto.birthDate) : undefined,
        gender: dto.gender,
        email: dto.email,
        phoneNumber: dto.phoneNumber,
        position: dto.position,
        memberRole: dto.memberRole,
        avatarUrl: dto.avatarUrl,
        orderIndex: dto.orderIndex,
      },
    });

    return this.findOne(teamId, team.captainId);
  }

  /** Xóa thành viên — validate lại để không tụt xuống dưới minTeamSize */
  async removeMember(teamId: string, memberId: string) {
    const team = await this.loadEditableTeam(teamId);
    const current = await this.loadRosterAsInput(teamId);

    const target = current.find((m) => m.id === memberId);
    if (!target) {
      throw new NotFoundException('Không tìm thấy thành viên trong đội này');
    }

    await this.validateRoster(
      team.tournamentId,
      current.filter((m) => m.id !== memberId),
      teamId,
    );

    await this.prisma.teamMember.delete({ where: { id: memberId } });
    return this.findOne(teamId, team.captainId);
  }

  /**
   * Duyệt / từ chối đội (UC-U08) — chỉ BTC
   * - REJECTED bắt buộc kèm lý do để hiển thị lại cho đội trưởng
   * - APPROVED phải kiểm tra lại `maxTeams` vì slot có thể đã đầy sau khi đội đăng ký
   */
  async updateStatus(teamId: string, dto: UpdateTeamStatusDto) {
    if (dto.status === RegistrationStatus.PENDING) {
      throw new BadRequestException(
        'Chỉ được chuyển đội sang trạng thái APPROVED hoặc REJECTED',
      );
    }

    if (
      dto.status === RegistrationStatus.REJECTED &&
      !dto.rejectReason?.trim()
    ) {
      throw new BadRequestException('Phải nhập lý do khi từ chối đội');
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        captainId: true,
        tournamentId: true,
        tournament: { select: { maxTeams: true } },
      },
    });

    if (!team) {
      throw new NotFoundException('Không tìm thấy đội');
    }

    if (
      dto.status === RegistrationStatus.APPROVED &&
      team.tournament.maxTeams
    ) {
      const approved = await this.prisma.team.count({
        where: {
          tournamentId: team.tournamentId,
          status: RegistrationStatus.APPROVED,
        },
      });
      if (approved >= team.tournament.maxTeams) {
        throw new BadRequestException(
          'Giải đấu đã đủ số đội được duyệt, không thể duyệt thêm',
        );
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.team.update({
        where: { id: teamId },
        data: {
          status: dto.status,
          rejectReason:
            dto.status === RegistrationStatus.REJECTED
              ? dto.rejectReason!.trim()
              : null,
          reviewedAt: new Date(),
        },
        include: {
          captain: { select: CAPTAIN_SELECT },
          members: { orderBy: { orderIndex: 'asc' } },
        },
      });
      const notification = await this.notifications.createNotification(
        {
          userId: team.captainId,
          type:
            dto.status === RegistrationStatus.APPROVED
              ? NotificationType.TEAM_APPROVED
              : NotificationType.TEAM_REJECTED,
          content:
            dto.status === RegistrationStatus.APPROVED
              ? `Đội "${team.name}" đã được duyệt tham gia giải`
              : `Đội "${team.name}" đã bị từ chối. Lý do: ${dto.rejectReason!.trim()}`,
          tournamentId: team.tournamentId,
        },
        tx,
        false,
      );
      return { updated, notification };
    });
    this.notifications.emitCreated(result.notification);

    if (dto.status === RegistrationStatus.APPROVED) {
      this.events?.publish({
        tournamentId: team.tournamentId,
        event: 'teamApproved',
        payload: result.updated,
      });
    }

    return result.updated;
  }

  /**
   * Rút đăng ký / xóa đội.
   * Đội trưởng chỉ được tự rút khi còn PENDING; BTC xóa được cả đội đã duyệt.
   */
  async remove(teamId: string, userId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        status: true,
        captainId: true,
        tournament: { select: { organizerId: true } },
      },
    });

    if (!team) {
      throw new NotFoundException('Không tìm thấy đội');
    }

    const isOrganizer = team.tournament.organizerId === userId;
    if (!isOrganizer && team.status !== RegistrationStatus.PENDING) {
      throw new ForbiddenException(
        'Đội đã được duyệt nên không thể tự rút đăng ký, vui lòng liên hệ ban tổ chức',
      );
    }

    await this.prisma.team.delete({ where: { id: teamId } });
    return { message: 'Đã xóa đội thành công' };
  }

  /**
   * Cấu hình form đăng ký (GĐ 4.1) — FE gọi trước khi render form
   * - Trả ràng buộc của giải + vị trí thi đấu hợp lệ của game
   * - Prefill thông tin người đại diện từ tài khoản đang đăng nhập
   * - `canRegister = false` kèm `reason` nếu user chưa đủ điều kiện đăng ký
   */
  async getRegistrationForm(slug: string, user: AuthenticatedUser) {
    const tournament = await this.loadTournamentForRegistration(slug);
    const { game } = tournament;

    const reason = await this.resolveBlockingReason(tournament, user.id);

    return {
      canRegister: reason === null,
      reason,
      tournament: {
        id: tournament.id,
        slug: tournament.slug,
        name: tournament.name,
        status: tournament.status,
        minTeamSize: tournament.minTeamSize,
        maxTeamSize: tournament.maxTeamSize,
        maxSubstitutes: tournament.maxTeamSize - tournament.minTeamSize,
        minAge: tournament.minAge,
        maxAge: tournament.maxAge,
        allowedGenders: tournament.allowedGenders,
        registrationStartDate: tournament.registrationStartDate,
        registrationDeadline: tournament.registrationDeadline,
        requireMemberFullInfo: tournament.requireMemberFullInfo,
      },
      game: {
        id: game.id,
        name: game.name,
        genre: game.genre,
        positions: game.positions ?? [],
        positionMode: game.positionMode,
      },
      prefill: {
        contactName: user.displayName,
        contactEmail: user.email,
        contactPhone: user.phoneNumber,
        captainMember: {
          realName: user.displayName,
          birthDate: user.birthDate,
          gender: user.gender,
          email: user.email,
          phoneNumber: user.phoneNumber,
          memberRole: MemberRole.CAPTAIN,
        },
      },
    };
  }

  // ─── Private helpers ────────────────────────────────────────

  /**
   * Ghi `Team` + `TeamMember[]` trong 1 transaction sau khi đã qua validator.
   * Dùng chung cho luồng user tự đăng ký và BTC thêm đội thủ công.
   */
  private async createTeam(
    tournament: TournamentForRegistration,
    captainUserId: string,
    dto: RegisterTeamDto,
    options: { status: RegistrationStatus; notifyOrganizer: boolean },
  ) {
    await this.assertTeamNameAvailable(tournament.id, dto.name);
    this.assertContentAllowed(dto.name, dto.description);

    const rules = this.validator.buildRules(tournament);
    const { captainIndex } = await this.validator.validate(
      rules,
      dto.members.map(toRegistrationValidationInput),
    );

    let organizerNotification:
      | Awaited<ReturnType<NotificationService['createNotification']>>
      | undefined;
    const result = await this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: dto.name,
          shortName: dto.shortName,
          description: dto.description,
          logoUrl: dto.logoUrl,
          contactName: dto.contactName,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
          tournamentId: tournament.id,
          captainId: captainUserId,
          status: options.status,
          reviewedAt:
            options.status === RegistrationStatus.APPROVED ? new Date() : null,
        },
      });

      await tx.teamMember.createMany({
        data: dto.members.map((m, index) => ({
          teamId: team.id,
          // Chỉ đội trưởng được gắn tài khoản; các thành viên khác là hồ sơ nhập tay
          userId: index === captainIndex ? captainUserId : null,
          realName: m.realName,
          ign: m.ign,
          inGameId: m.inGameId,
          birthDate: m.birthDate ? new Date(m.birthDate) : null,
          gender: m.gender,
          email: m.email,
          phoneNumber: m.phoneNumber,
          position: m.position,
          memberRole:
            index === captainIndex
              ? MemberRole.CAPTAIN
              : (m.memberRole ?? MemberRole.PLAYER),
          avatarUrl: m.avatarUrl,
          orderIndex: m.orderIndex ?? index,
        })),
      });

      if (options.notifyOrganizer) {
        organizerNotification = await this.notifications.createNotification(
          {
            userId: tournament.organizerId,
            type: NotificationType.SYSTEM,
            content: `Đội "${team.name}" vừa đăng ký tham gia giải "${tournament.name}"`,
            tournamentId: tournament.id,
          },
          tx,
          false,
        );
      }

      return tx.team.findUnique({
        where: { id: team.id },
        include: {
          captain: { select: CAPTAIN_SELECT },
          members: { orderBy: { orderIndex: 'asc' } },
          _count: { select: { members: true } },
        },
      });
    });
    if (organizerNotification) {
      this.notifications.emitCreated(organizerNotification);
    }
    return result;
  }

  private async loadTournamentForRegistration(slug: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      include: {
        game: {
          select: {
            id: true,
            name: true,
            genre: true,
            positions: true,
            positionMode: true,
          },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    return tournament;
  }

  /** Chạy validator trên roster hiện tại của 1 đội đã tồn tại */
  private async validateRoster(
    tournamentId: string,
    members: RegistrationMemberInput[],
    teamId: string,
  ) {
    const tournament = await this.prisma.tournament.findUniqueOrThrow({
      where: { id: tournamentId },
      include: {
        game: {
          select: { positions: true, positionMode: true },
        },
      },
    });

    const rules = this.validator.buildRules(tournament);
    await this.validator.validate(rules, members, teamId);
  }

  /** Roster trong DB → dạng input của validator (giữ `id` để lọc/merge) */
  private async loadRosterAsInput(
    teamId: string,
  ): Promise<(RegistrationMemberInput & { id: string })[]> {
    const members = await this.prisma.teamMember.findMany({
      where: { teamId },
      orderBy: { orderIndex: 'asc' },
    });

    return members.map((m) => ({
      id: m.id,
      realName: m.realName,
      ign: m.ign,
      inGameId: m.inGameId ?? undefined,
      birthDate: m.birthDate?.toISOString(),
      gender: m.gender ?? undefined,
      email: m.email ?? undefined,
      phoneNumber: m.phoneNumber ?? undefined,
      position: m.position ?? undefined,
      memberRole: m.memberRole,
      avatarUrl: m.avatarUrl ?? undefined,
      orderIndex: m.orderIndex,
    }));
  }

  /** Guard kiểm tra quyền; helper này áp dụng cùng một registration lock cho mọi roster mutation. */
  private async loadEditableTeam(teamId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        status: true,
        captainId: true,
        tournamentId: true,
        tournament: {
          select: {
            status: true,
            registrationOpen: true,
            registrationStartDate: true,
            registrationDeadline: true,
            startDate: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Không tìm thấy đội');
    }

    this.assertRosterLifecycleOpen(team.tournament);

    return team;
  }

  private assertRosterLifecycleOpen(tournament: {
    status: TournamentStatus;
    registrationOpen: boolean;
    registrationStartDate: Date | null;
    registrationDeadline: Date | null;
    startDate: Date | null;
  }) {
    const now = new Date();
    const registrationIsOpen =
      tournament.status === TournamentStatus.REGISTRATION &&
      tournament.registrationOpen &&
      (!tournament.registrationStartDate ||
        now >= tournament.registrationStartDate) &&
      (!tournament.registrationDeadline ||
        now <= tournament.registrationDeadline) &&
      (!tournament.startDate || now < tournament.startDate);

    if (!registrationIsOpen) {
      throw new BadRequestException(
        'Giải đấu đã khóa đăng ký nên không thể chỉnh sửa hồ sơ hoặc đội hình',
      );
    }
  }

  /** Tên đội là unique trong phạm vi 1 giải — báo lỗi tiếng Việt thay vì P2002 */
  private async assertTeamNameAvailable(
    tournamentId: string,
    name: string,
    excludeTeamId?: string,
  ) {
    const duplicated = await this.prisma.team.findFirst({
      where: {
        tournamentId,
        name,
        ...(excludeTeamId ? { id: { not: excludeTeamId } } : {}),
      },
      select: { id: true },
    });

    if (duplicated) {
      throw new BadRequestException('Tên đội đã tồn tại trong giải đấu này');
    }
  }

  /**
   * Hook lọc từ khóa cấm cho tên/giới thiệu đội.
   * `ContentFilterService` của GĐ 8 sẽ thay phần thân rỗng này.
   */
  private assertContentAllowed(name?: string, description?: string) {
    if (name !== undefined) this.contentFilter.validate(name);
    if (description !== undefined) {
      this.contentFilter.validate(description);
    }
  }

  private countOccupiedSlots(tournamentId: string) {
    return this.prisma.team.count({
      where: {
        tournamentId,
        status: {
          in: [RegistrationStatus.APPROVED, RegistrationStatus.PENDING],
        },
      },
    });
  }

  /**
   * Lý do user KHÔNG được đăng ký giải này, hoặc null nếu hợp lệ.
   * Dùng chung cho `GET /registration-form` (hiển thị trước) và `POST /register`
   * (chặn thật) để 2 nơi không lệch luật nhau.
   */
  private async resolveBlockingReason(
    tournament: {
      id: string;
      status: TournamentStatus;
      registrationOpen: boolean;
      registrationStartDate: Date | null;
      registrationDeadline: Date | null;
      maxTeams: number | null;
      organizerId: string;
    },
    userId: string,
  ): Promise<string | null> {
    if (tournament.organizerId === userId) {
      return 'Bạn là ban tổ chức của giải này nên không thể tự đăng ký tham gia';
    }

    if (tournament.status !== TournamentStatus.REGISTRATION) {
      return 'Giải đấu hiện không ở giai đoạn nhận đăng ký';
    }

    if (!tournament.registrationOpen) {
      return 'Giải đấu đã đóng đăng ký';
    }

    const now = new Date();
    if (
      tournament.registrationStartDate &&
      now < tournament.registrationStartDate
    ) {
      return 'Giải đấu chưa tới thời điểm mở đăng ký';
    }

    if (
      tournament.registrationDeadline &&
      now > tournament.registrationDeadline
    ) {
      return 'Đã quá hạn chót đăng ký';
    }

    // Slot đã dùng tính cả đội đang chờ duyệt, tránh nhận vượt quá maxTeams
    if (tournament.maxTeams) {
      const occupied = await this.countOccupiedSlots(tournament.id);
      if (occupied >= tournament.maxTeams) {
        return 'Giải đấu đã đủ số đội tham gia';
      }
    }

    const existingTeam = await this.prisma.team.findFirst({
      where: {
        tournamentId: tournament.id,
        status: {
          in: [RegistrationStatus.APPROVED, RegistrationStatus.PENDING],
        },
        OR: [{ captainId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true },
    });

    if (existingTeam) {
      return 'Bạn đã có đội trong giải đấu này';
    }

    return null;
  }
}

function toRegistrationValidationInput(
  member: TeamMemberInputDto,
): RegistrationMemberInput {
  return {
    realName: member.realName,
    ign: member.ign,
    inGameId: member.inGameId,
    birthDate: member.birthDate,
    gender: member.gender,
    email: member.email,
    phoneNumber: member.phoneNumber,
    position: member.position,
    memberRole: member.memberRole,
  };
}

/** Giải đấu kèm ràng buộc của Game — đầu vào của validator và luồng tạo đội */
type TournamentForRegistration = Prisma.TournamentGetPayload<{
  include: {
    game: {
      select: {
        id: true;
        name: true;
        genre: true;
        positions: true;
        positionMode: true;
      };
    };
  };
}>;

/** Bỏ key undefined để merge không ghi đè dữ liệu hiện có */
function stripUndefined<T extends object>(obj: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(obj).filter(([, v]) => v !== undefined),
  ) as Partial<T>;
}
