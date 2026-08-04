import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MemberRole,
  Prisma,
  RegistrationStatus,
  TournamentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import {
  RegisterTeamDto,
  TeamMemberInputDto,
} from './dto/register-team.dto';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Tên đội là unique trong phạm vi 1 giải — kiểm tra trước để trả lỗi tiếng Việt
   * thay vì để Prisma ném P2002.
   */
  private async assertTeamNameAvailable(tournamentId: string, name: string) {
    const duplicated = await this.prisma.team.findFirst({
      where: { tournamentId, name },
      select: { id: true },
    });

    if (duplicated) {
      throw new BadRequestException('Tên đội đã tồn tại trong giải đấu này');
    }
  }

  /**
   * Chuẩn hóa roster trước khi ghi DB:
   * - Đúng 1 đội trưởng: nếu FE không gửi CAPTAIN nào thì gán cho thành viên đầu tiên
   * - Gắn userId của người đăng ký vào đúng thành viên đội trưởng
   * - Giữ thứ tự FE gửi lên làm orderIndex mặc định
   */
  private buildMemberRows(
    members: TeamMemberInputDto[],
    teamId: string,
    captainUserId: string,
  ): Prisma.TeamMemberCreateManyInput[] {
    const captainIndex = members.findIndex(
      (m) => m.memberRole === MemberRole.CAPTAIN,
    );
    const resolvedCaptainIndex = captainIndex === -1 ? 0 : captainIndex;

    return members.map((m, index) => ({
      teamId,
      userId: index === resolvedCaptainIndex ? captainUserId : null,
      realName: m.realName,
      ign: m.ign,
      inGameId: m.inGameId,
      birthDate: m.birthDate ? new Date(m.birthDate) : null,
      gender: m.gender,
      email: m.email,
      phoneNumber: m.phoneNumber,
      position: m.position,
      memberRole:
        index === resolvedCaptainIndex
          ? MemberRole.CAPTAIN
          : (m.memberRole ?? MemberRole.PLAYER),
      avatarUrl: m.avatarUrl,
      orderIndex: m.orderIndex ?? index,
    }));
  }

  /**
   * Đăng ký đội tham gia giải (UC-U11) — người dùng tự đăng ký
   * - Người đăng ký trở thành captain
   * - Dùng lại đúng bộ điều kiện của `getRegistrationForm` để FE và BE không lệch nhau
   */
  async register(userId: string, tournamentId: string, dto: RegisterTeamDto) {
    // 1. Kiểm tra giải tồn tại & user đủ điều kiện đăng ký
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    const reason = await this.resolveBlockingReason(tournament, userId);
    if (reason) {
      throw new BadRequestException(reason);
    }

    await this.assertTeamNameAvailable(tournamentId, dto.name);

    // 3. Tạo đội + roster (transaction)
    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: dto.name,
          shortName: dto.shortName,
          description: dto.description,
          logoUrl: dto.logoUrl,
          contactName: dto.contactName,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
          tournamentId,
          captainId: userId,
          status: RegistrationStatus.PENDING, // chờ BTC duyệt (UC-U08)
        },
      });

      await tx.teamMember.createMany({
        data: this.buildMemberRows(dto.members, team.id, userId),
      });

      return tx.team.findUnique({
        where: { id: team.id },
        include: {
          captain: { select: { id: true, displayName: true, avatarUrl: true } },
          members: { orderBy: { orderIndex: 'asc' } },
          _count: { select: { members: true } },
        },
      });
    });
  }

  /**
   * BTC thêm đội thủ công (UC-U06) — dùng lại DTO nhập thông tin đội (UC-U07)
   * - Đội được tạo trực tiếp với status APPROVED (do BTC chủ động)
   * - Người dùng đăng nhập (BTC) là người thêm
   */
  async addManual(
    organizerId: string,
    tournamentId: string,
    dto: RegisterTeamDto,
  ) {
    // 1. Kiểm tra giải tồn tại
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { id: true, maxTeams: true, _count: { select: { teams: true } } },
    });

    if (!tournament) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    if (tournament.maxTeams && tournament._count.teams >= tournament.maxTeams) {
      throw new BadRequestException('Giải đấu đã đủ số đội tham gia');
    }

    await this.assertTeamNameAvailable(tournamentId, dto.name);

    // 2. Tạo đội + roster, captain mặc định là BTC (organizer)
    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: dto.name,
          shortName: dto.shortName,
          description: dto.description,
          logoUrl: dto.logoUrl,
          contactName: dto.contactName,
          contactEmail: dto.contactEmail,
          contactPhone: dto.contactPhone,
          tournamentId,
          captainId: organizerId,
          status: RegistrationStatus.APPROVED, // BTC thêm trực tiếp → APPROVED
          reviewedAt: new Date(),
        },
      });

      await tx.teamMember.createMany({
        data: this.buildMemberRows(dto.members, team.id, organizerId),
      });

      return tx.team.findUnique({
        where: { id: team.id },
        include: {
          captain: { select: { id: true, displayName: true, avatarUrl: true } },
          members: { orderBy: { orderIndex: 'asc' } },
          _count: { select: { members: true } },
        },
      });
    });
  }

  /**
   * Cấu hình form đăng ký (GĐ 4.1) — FE gọi trước khi render form
   * - Trả ràng buộc của giải + vị trí thi đấu hợp lệ của game
   * - Prefill thông tin người đại diện từ tài khoản đang đăng nhập
   * - `canRegister = false` kèm `reason` nếu user chưa đủ điều kiện đăng ký
   */
  async getRegistrationForm(slug: string, user: AuthenticatedUser) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
      include: {
        game: {
          select: {
            id: true,
            name: true,
            genre: true,
            positions: true,
            defaultTeamSize: true,
            minTeamSize: true,
            maxTeamSize: true,
          },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    const { game } = tournament;
    const minTeamSize = tournament.minTeamSize ?? game.minTeamSize;
    const maxTeamSize = tournament.maxTeamSize ?? game.maxTeamSize;

    const reason = await this.resolveBlockingReason(tournament, user.id);

    return {
      canRegister: reason === null,
      reason,
      tournament: {
        id: tournament.id,
        slug: tournament.slug,
        name: tournament.name,
        status: tournament.status,
        minTeamSize,
        maxTeamSize,
        maxSubstitutes: tournament.maxSubstitutes,
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

    if (tournament.registrationDeadline && now > tournament.registrationDeadline) {
      return 'Đã quá hạn chót đăng ký';
    }

    // Slot đã dùng tính cả đội đang chờ duyệt, tránh nhận vượt quá maxTeams
    if (tournament.maxTeams) {
      const occupied = await this.prisma.team.count({
        where: {
          tournamentId: tournament.id,
          status: {
            in: [RegistrationStatus.APPROVED, RegistrationStatus.PENDING],
          },
        },
      });
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

  async findByTournament(tournamentId: string, status?: string) {
    const where: Prisma.TeamWhereInput = { tournamentId };

    if (status && status !== 'ALL') {
      const validStatus = status.toUpperCase() as RegistrationStatus;
      if (!['PENDING', 'APPROVED', 'REJECTED'].includes(validStatus)) {
        throw new BadRequestException('Trạng thái lọc không hợp lệ');
      }
      where.status = validStatus;
    }

    return this.prisma.team.findMany({
      where,
      orderBy: { registeredAt: 'asc' },
      include: {
        captain: { select: { id: true, displayName: true, avatarUrl: true } },
        members: {
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            realName: true,
            ign: true,
            position: true,
            memberRole: true,
            avatarUrl: true,
          },
        },
        _count: { select: { members: true } },
      },
    });
  }

  /**
   * Duyệt / từ chối đội (UC-U08) — chỉ BTC
   * - status = APPROVED hoặc REJECTED
   * - REJECTED bắt buộc kèm lý do để hiển thị lại cho đội trưởng
   * - Tạo thông báo cho captain
   */
  async updateStatus(
    teamId: string,
    status: RegistrationStatus,
    tournamentId: string,
    rejectReason?: string,
  ) {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new BadRequestException('Trạng thái không hợp lệ');
    }

    if (status === RegistrationStatus.REJECTED && !rejectReason?.trim()) {
      throw new BadRequestException('Phải nhập lý do khi từ chối đội');
    }

    // Kiểm tra đội thuộc giải
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, tournamentId },
      include: { captain: { select: { id: true } } },
    });

    if (!team) {
      throw new NotFoundException('Không tìm thấy đội');
    }

    const updated = await this.prisma.team.update({
      where: { id: teamId },
      data: {
        status,
        rejectReason:
          status === RegistrationStatus.REJECTED ? rejectReason!.trim() : null,
        reviewedAt: new Date(),
      },
      include: {
        captain: { select: { id: true, displayName: true, avatarUrl: true } },
        members: { orderBy: { orderIndex: 'asc' } },
      },
    });

    // Tạo thông báo cho captain
    await this.prisma.notification.create({
      data: {
        userId: team.captainId,
        type: status === 'APPROVED' ? 'TEAM_APPROVED' : 'TEAM_REJECTED',
        content:
          status === 'APPROVED'
            ? `Đội "${team.name}" đã được duyệt tham gia giải`
            : `Đội "${team.name}" đã bị từ chối. Lý do: ${rejectReason!.trim()}`,
        tournamentId,
      },
    });

    return updated;
  }

  /**
   * Xóa đội (UC-U06) — chỉ BTC / captain
   */
  async remove(teamId: string, tournamentId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id: teamId, tournamentId },
      select: { id: true },
    });

    if (!team) {
      throw new NotFoundException('Không tìm thấy đội');
    }

    await this.prisma.team.delete({ where: { id: teamId } });
    return { message: 'Đã xóa đội thành công' };
  }
}
