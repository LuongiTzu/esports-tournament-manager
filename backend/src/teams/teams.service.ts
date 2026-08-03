import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterTeamDto } from './dto/register-team.dto';

@Injectable()
export class TeamsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Đăng ký đội tham gia giải (UC-U11) — người dùng tự đăng ký
   * - Người đăng ký trở thành captain
   * - Kiểm tra giải đang mở đăng ký, chưa đủ số đội
   * - Kiểm tra người dùng chưa có đội trong giải này
   */
  async register(userId: string, tournamentId: string, dto: RegisterTeamDto) {
    // 1. Kiểm tra giải tồn tại & đang mở đăng ký
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: { _count: { select: { teams: true } } },
    });

    if (!tournament) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    if (!tournament.registrationOpen) {
      throw new BadRequestException('Giải đấu đã đóng đăng ký');
    }

    if (tournament.maxTeams && tournament._count.teams >= tournament.maxTeams) {
      throw new BadRequestException('Giải đấu đã đủ số đội tham gia');
    }

    // 2. Kiểm tra người dùng chưa có đội trong giải này
    const existingTeam = await this.prisma.team.findFirst({
      where: {
        tournamentId,
        OR: [{ captainId: userId }, { members: { some: { userId } } }],
      },
      select: { id: true },
    });

    if (existingTeam) {
      throw new BadRequestException('Bạn đã tham gia giải đấu này');
    }

    // 3. Tạo đội + captain (transaction)
    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: dto.name,
          logoUrl: dto.logoUrl,
          tournamentId,
          captainId: userId,
          status: RegistrationStatus.PENDING, // chờ BTC duyệt (UC-U08)
        },
      });

      // Tạo captain làm thành viên đầu tiên
      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId,
          ign: dto.name, // captain dùng tên đội làm IGN mặc định
        },
      });

      // Tạo các thành viên khác nếu có
      if (dto.members?.length) {
        await tx.teamMember.createMany({
          data: dto.members.map((m) => ({
            teamId: team.id,
            ign: m.ign,
            contactInfo: m.contactInfo,
          })),
        });
      }

      return tx.team.findUnique({
        where: { id: team.id },
        include: {
          captain: { select: { id: true, displayName: true, avatarUrl: true } },
          members: true,
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

    // 2. Tạo đội + captain mặc định là BTC (organizer)
    return this.prisma.$transaction(async (tx) => {
      const team = await tx.team.create({
        data: {
          name: dto.name,
          logoUrl: dto.logoUrl,
          tournamentId,
          captainId: organizerId,
          status: RegistrationStatus.APPROVED, // BTC thêm trực tiếp → APPROVED
        },
      });

      // Tạo captain làm thành viên đầu tiên
      await tx.teamMember.create({
        data: {
          teamId: team.id,
          userId: organizerId,
          ign: dto.name,
        },
      });

      // Tạo các thành viên khác nếu có
      if (dto.members?.length) {
        await tx.teamMember.createMany({
          data: dto.members.map((m) => ({
            teamId: team.id,
            ign: m.ign,
            contactInfo: m.contactInfo,
          })),
        });
      }

      return tx.team.findUnique({
        where: { id: team.id },
        include: {
          captain: { select: { id: true, displayName: true, avatarUrl: true } },
          members: true,
          _count: { select: { members: true } },
        },
      });
    });
  }

  /**
   * Danh sách đội của 1 giải (UC-G05, UC-U12)
   * - status lọc: APPROVED (mặc định), PENDING, REJECTED, ALL
   */
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
        members: { select: { id: true, ign: true, contactInfo: true } },
        _count: { select: { members: true } },
      },
    });
  }

  /**
   * Duyệt / từ chối đội (UC-U08) — chỉ BTC
   * - status = APPROVED hoặc REJECTED
   * - Tạo thông báo cho captain
   */
  async updateStatus(
    teamId: string,
    status: RegistrationStatus,
    tournamentId: string,
  ) {
    if (!['APPROVED', 'REJECTED'].includes(status)) {
      throw new BadRequestException('Trạng thái không hợp lệ');
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
      data: { status },
      include: {
        captain: { select: { id: true, displayName: true, avatarUrl: true } },
        members: true,
      },
    });

    // Tạo thông báo cho captain
    await this.prisma.notification.create({
      data: {
        userId: team.captainId,
        type: status === 'APPROVED' ? 'TEAM_APPROVED' : 'TEAM_REJECTED',
        content: `Đội "${team.name}" đã được ${status === 'APPROVED' ? 'duyệt' : 'từ chối'} tham gia giải`,
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
