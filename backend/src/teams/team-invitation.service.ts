import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  MemberRole,
  TeamInvitationPurpose,
  TeamInvitationStatus,
  TournamentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../email/email.service';
import { AuthenticatedUser } from '../auth/strategies/jwt.strategy';
import { RegisterTeamDto } from './dto/register-team.dto';
import { TeamsService } from './teams.service';
import { TeamInvitationTokenService } from './team-invitation-token.service';

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class TeamInvitationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teams: TeamsService,
    private readonly tokens: TeamInvitationTokenService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async listForTournament(organizerId: string, slug: string) {
    const tournament = await this.requireOwnedTournament(organizerId, slug);
    await this.expirePending(tournament.id);
    return this.prisma.teamInvitation.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        purpose: true,
        status: true,
        email: true,
        expiresAt: true,
        acceptedAt: true,
        revokedAt: true,
        createdAt: true,
        team: { select: { id: true, name: true } },
        member: { select: { id: true, realName: true, ign: true } },
        acceptedBy: { select: { id: true, displayName: true, email: true } },
      },
    });
  }

  async inviteTeam(organizerId: string, slug: string, rawEmail: string) {
    const tournament = await this.requireOwnedTournament(organizerId, slug);
    this.assertCanInviteRegistration(tournament);
    return this.issueInvitation({
      organizerId,
      email: this.normalizeEmail(rawEmail),
      purpose: TeamInvitationPurpose.TEAM_REGISTRATION,
      tournament,
    });
  }

  async inviteMember(actorId: string, teamId: string, memberId: string) {
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      include: {
        tournament: true,
        members: { where: { id: memberId } },
      },
    });
    if (!team) throw new NotFoundException('Không tìm thấy đội');
    const isOrganizer = team.tournament.organizerId === actorId;
    const isCaptain = team.captainId === actorId;
    if (!isOrganizer && !isCaptain) {
      throw new ForbiddenException('Bạn không có quyền mời thành viên đội này');
    }
    const member = team.members[0];
    if (!member) throw new NotFoundException('Không tìm thấy thành viên');
    if (!member.email) {
      throw new BadRequestException(
        'Thành viên cần có email trước khi gửi lời mời',
      );
    }

    const isOrganizerPlaceholderCaptain =
      member.memberRole === MemberRole.CAPTAIN &&
      isOrganizer &&
      team.captainId === actorId &&
      member.userId === actorId;
    if (member.userId && !isOrganizerPlaceholderCaptain) {
      throw new BadRequestException(
        'Thành viên đã được liên kết với tài khoản',
      );
    }

    return this.issueInvitation({
      organizerId: actorId,
      email: this.normalizeEmail(member.email),
      purpose: isOrganizerPlaceholderCaptain
        ? TeamInvitationPurpose.TEAM_CLAIM
        : TeamInvitationPurpose.MEMBER_LINK,
      tournament: team.tournament,
      teamId: team.id,
      memberId: member.id,
    });
  }

  async preview(rawToken: string) {
    const invitation = await this.requireUsableInvitation(rawToken);
    return {
      purpose: invitation.purpose,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
      tournament: {
        id: invitation.tournament.id,
        slug: invitation.tournament.slug,
        name: invitation.tournament.name,
        description: invitation.tournament.description,
        status: invitation.tournament.status,
        mode: invitation.tournament.mode,
        registrationDeadline: invitation.tournament.registrationDeadline,
        startDate: invitation.tournament.startDate,
        minTeamSize: invitation.tournament.minTeamSize,
        maxTeamSize: invitation.tournament.maxTeamSize,
        organizer: invitation.tournament.organizer,
        game: invitation.tournament.game,
      },
      team: invitation.team,
      member: invitation.member,
    };
  }

  async getRegistrationForm(rawToken: string, user: AuthenticatedUser) {
    const invitation = await this.requireUsableInvitation(rawToken);
    this.assertRecipient(invitation.email, user);
    if (invitation.purpose !== TeamInvitationPurpose.TEAM_REGISTRATION) {
      throw new BadRequestException('Lời mời này không dùng để đăng ký đội');
    }
    return this.teams.getInvitedRegistrationForm(
      invitation.tournament.slug,
      user,
    );
  }

  async acceptTeamRegistration(
    rawToken: string,
    user: AuthenticatedUser,
    dto: RegisterTeamDto,
  ) {
    const invitation = await this.requireUsableInvitation(rawToken);
    this.assertRecipient(invitation.email, user);
    if (invitation.purpose !== TeamInvitationPurpose.TEAM_REGISTRATION) {
      throw new BadRequestException('Lời mời này không dùng để đăng ký đội');
    }
    return this.teams.registerInvited(
      user.id,
      invitation.tournament.slug,
      dto,
      invitation.id,
    );
  }

  async acceptAccountLink(rawToken: string, user: AuthenticatedUser) {
    const invitation = await this.requireUsableInvitation(rawToken);
    this.assertRecipient(invitation.email, user);
    if (invitation.purpose === TeamInvitationPurpose.TEAM_REGISTRATION) {
      throw new BadRequestException('Lời mời này yêu cầu đăng ký đội');
    }
    if (!invitation.teamId || !invitation.memberId) {
      throw new BadRequestException('Lời mời thiếu thông tin đội');
    }

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.teamInvitation.findUnique({
        where: { id: invitation.id },
      });
      if (
        !current ||
        current.status !== TeamInvitationStatus.PENDING ||
        current.expiresAt <= new Date()
      ) {
        throw new BadRequestException('Lời mời không còn hiệu lực');
      }

      const member = await tx.teamMember.findUnique({
        where: { id: invitation.memberId! },
        include: { team: { include: { tournament: true } } },
      });
      if (!member || member.teamId !== invitation.teamId) {
        throw new NotFoundException('Không tìm thấy thành viên được mời');
      }
      const existingMembership = await tx.teamMember.findFirst({
        where: { teamId: member.teamId, userId: user.id },
        select: { id: true },
      });
      if (existingMembership && existingMembership.id !== member.id) {
        throw new BadRequestException('Tài khoản đã được liên kết với đội này');
      }

      if (invitation.purpose === TeamInvitationPurpose.TEAM_CLAIM) {
        if (
          member.memberRole !== MemberRole.CAPTAIN ||
          member.team.captainId !== member.team.tournament.organizerId ||
          member.userId !== member.team.tournament.organizerId
        ) {
          throw new BadRequestException(
            'Đội không còn ở trạng thái chờ nhận quyền',
          );
        }
        await tx.team.update({
          where: { id: member.teamId },
          data: { captainId: user.id },
        });
      } else if (member.userId !== null) {
        throw new BadRequestException(
          'Thành viên đã được liên kết với tài khoản',
        );
      }

      await tx.teamMember.update({
        where: { id: member.id },
        data: { userId: user.id },
      });
      await tx.teamInvitation.update({
        where: { id: invitation.id },
        data: {
          status: TeamInvitationStatus.ACCEPTED,
          acceptedAt: new Date(),
          acceptedById: user.id,
        },
      });
      return {
        tournamentSlug: member.team.tournament.slug,
        teamId: member.teamId,
      };
    });
  }

  async revoke(organizerId: string, invitationId: string) {
    const invitation = await this.prisma.teamInvitation.findUnique({
      where: { id: invitationId },
      include: { tournament: { select: { organizerId: true } } },
    });
    if (!invitation) throw new NotFoundException('Không tìm thấy lời mời');
    if (invitation.tournament.organizerId !== organizerId) {
      throw new ForbiddenException('Bạn không có quyền thu hồi lời mời này');
    }
    if (invitation.status !== TeamInvitationStatus.PENDING) {
      throw new BadRequestException('Chỉ có thể thu hồi lời mời đang chờ');
    }
    return this.prisma.teamInvitation.update({
      where: { id: invitation.id },
      data: {
        status: TeamInvitationStatus.REVOKED,
        revokedAt: new Date(),
      },
    });
  }

  private async issueInvitation(input: {
    organizerId: string;
    email: string;
    purpose: TeamInvitationPurpose;
    tournament: {
      id: string;
      slug: string;
      name: string;
      registrationDeadline: Date | null;
      startDate: Date | null;
    };
    teamId?: string;
    memberId?: string;
  }) {
    const { token, hash } = this.tokens.create();
    const expiresAt = this.resolveExpiry(input.tournament, input.purpose);
    const invitation = await this.prisma.teamInvitation.create({
      data: {
        tournamentId: input.tournament.id,
        invitedById: input.organizerId,
        email: input.email,
        purpose: input.purpose,
        tokenHash: hash,
        expiresAt,
        teamId: input.teamId,
        memberId: input.memberId,
      },
    });

    const base = this.config.get<string>(
      'FRONTEND_URL',
      'http://localhost:3000',
    );
    const url = new URL(`/team-invitations/${token}`, base).toString();
    try {
      await this.email.sendActivity(input.email, {
        displayName: 'bạn',
        title: `Lời mời tham gia ${input.tournament.name}`,
        paragraphs: [
          'Bạn đã được mời tham gia một giải đấu riêng tư trên ArenaVerse.',
          `Lời mời có hiệu lực đến ${expiresAt.toLocaleString('vi-VN')}. Hãy đăng nhập bằng đúng email nhận thư để tiếp tục.`,
        ],
        action: { label: 'Xem lời mời', url },
      });
    } catch (error) {
      await this.prisma.teamInvitation.delete({ where: { id: invitation.id } });
      throw error;
    }
    await this.prisma.teamInvitation.updateMany({
      where: {
        id: { not: invitation.id },
        tournamentId: input.tournament.id,
        email: input.email,
        purpose: input.purpose,
        teamId: input.teamId ?? null,
        memberId: input.memberId ?? null,
        status: TeamInvitationStatus.PENDING,
      },
      data: {
        status: TeamInvitationStatus.REVOKED,
        revokedAt: new Date(),
      },
    });
    return { id: invitation.id, email: invitation.email, expiresAt };
  }

  private async requireUsableInvitation(rawToken: string) {
    const invitation = await this.prisma.teamInvitation.findUnique({
      where: { tokenHash: this.tokens.hash(rawToken) },
      include: {
        tournament: {
          include: {
            organizer: {
              select: { id: true, displayName: true, avatarUrl: true },
            },
            game: {
              select: { id: true, code: true, name: true, iconUrl: true },
            },
          },
        },
        team: { select: { id: true, name: true, status: true } },
        member: {
          select: { id: true, realName: true, ign: true, memberRole: true },
        },
      },
    });
    if (!invitation) throw new NotFoundException('Không tìm thấy lời mời');
    if (
      invitation.status === TeamInvitationStatus.PENDING &&
      invitation.expiresAt <= new Date()
    ) {
      await this.prisma.teamInvitation.update({
        where: { id: invitation.id },
        data: { status: TeamInvitationStatus.EXPIRED },
      });
      throw new BadRequestException('Lời mời đã hết hạn');
    }
    if (invitation.status !== TeamInvitationStatus.PENDING) {
      throw new BadRequestException('Lời mời không còn hiệu lực');
    }
    return invitation;
  }

  private async requireOwnedTournament(organizerId: string, slug: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { slug },
    });
    if (!tournament) throw new NotFoundException('Không tìm thấy giải đấu');
    if (tournament.organizerId !== organizerId) {
      throw new ForbiddenException('Bạn không có quyền quản lý giải đấu này');
    }
    return tournament;
  }

  private assertCanInviteRegistration(tournament: {
    status: TournamentStatus;
    registrationOpen: boolean;
    registrationStartDate: Date | null;
    registrationDeadline: Date | null;
    startDate: Date | null;
  }) {
    const now = new Date();
    if (tournament.status !== TournamentStatus.REGISTRATION) {
      throw new BadRequestException('Giải đấu hiện không nhận đăng ký');
    }
    if (!tournament.registrationOpen) {
      throw new BadRequestException('Giải đấu đã đóng đăng ký');
    }
    if (
      tournament.registrationStartDate &&
      now < tournament.registrationStartDate
    ) {
      throw new BadRequestException('Giải đấu chưa tới thời điểm nhận đăng ký');
    }
    if (
      tournament.registrationDeadline &&
      now > tournament.registrationDeadline
    ) {
      throw new BadRequestException('Đã quá hạn đăng ký');
    }
    if (tournament.startDate && now >= tournament.startDate) {
      throw new BadRequestException('Giải đấu đã bắt đầu');
    }
  }

  private resolveExpiry(
    tournament: {
      registrationDeadline: Date | null;
      startDate: Date | null;
    },
    purpose: TeamInvitationPurpose,
  ) {
    const candidates = [new Date(Date.now() + INVITATION_TTL_MS)];
    if (purpose === TeamInvitationPurpose.TEAM_REGISTRATION) {
      if (tournament.registrationDeadline)
        candidates.push(tournament.registrationDeadline);
      if (tournament.startDate) candidates.push(tournament.startDate);
    }
    return new Date(Math.min(...candidates.map((value) => value.getTime())));
  }

  private assertRecipient(email: string, user: AuthenticatedUser) {
    if (this.normalizeEmail(user.email) !== this.normalizeEmail(email)) {
      throw new ForbiddenException(
        'Lời mời được gửi tới một tài khoản email khác',
      );
    }
  }

  private normalizeEmail(email: string) {
    return email.trim().toLowerCase();
  }

  private expirePending(tournamentId: string) {
    return this.prisma.teamInvitation.updateMany({
      where: {
        tournamentId,
        status: TeamInvitationStatus.PENDING,
        expiresAt: { lte: new Date() },
      },
      data: { status: TeamInvitationStatus.EXPIRED },
    });
  }
}
