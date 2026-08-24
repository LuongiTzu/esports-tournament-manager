import {
  BadRequestException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MemberRole,
  NotificationType,
  Prisma,
  RegistrationStatus,
} from '@prisma/client';
import { ApplicationErrorCode } from '../common/errors/application-error-code';
import {
  NOTIFICATION_PUBLISHER,
  NotificationPublisher,
} from '../common/ports/notification-publisher';
import { PrismaService } from '../prisma/prisma.service';
import {
  TOURNAMENT_EVENT_PUBLISHER,
  TournamentEventPublisher,
} from '../common/ports/tournament-event-publisher';
import { RegistrationValidatorService } from './registration-validator.service';
import {
  InvalidRegistrationStatusTransitionError,
  TeamReviewPolicy,
} from './domain/team-review.policy';
import { RegistrationMemberInput } from './types/registration-member-input';
import { UpdateTeamStatusDto } from './dto/update-team.dto';

const CAPTAIN_SELECT = {
  id: true,
  displayName: true,
  avatarUrl: true,
} as const;

@Injectable()
export class TeamReviewService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly validator: RegistrationValidatorService,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notifications: NotificationPublisher,
    private readonly reviewPolicy: TeamReviewPolicy,
    @Inject(TOURNAMENT_EVENT_PUBLISHER)
    private readonly events: TournamentEventPublisher,
  ) {}

  async updateStatus(teamId: string, dto: UpdateTeamStatusDto) {
    if (
      dto.status === RegistrationStatus.REJECTED &&
      !dto.rejectReason?.trim()
    ) {
      throw new BadRequestException('Phải nhập lý do khi từ chối đội');
    }

    const reference = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { tournamentId: true },
    });
    if (!reference) throw new NotFoundException('Không tìm thấy đội');

    const result = await this.prisma.$transaction(async (tx) => {
      await this.lockTournament(tx, reference.tournamentId);
      const team = await tx.team.findUnique({
        where: { id: teamId },
        select: {
          id: true,
          name: true,
          status: true,
          captainId: true,
          tournamentId: true,
          members: { orderBy: { orderIndex: 'asc' } },
          tournament: {
            include: {
              game: {
                select: { positions: true, positionMode: true },
              },
            },
          },
        },
      });
      if (!team) throw new NotFoundException('Không tìm thấy đội');

      try {
        this.reviewPolicy.assertCanReview(team.status, dto.status);
      } catch (error) {
        if (error instanceof InvalidRegistrationStatusTransitionError) {
          throw new BadRequestException({
            message: error.message,
            code: ApplicationErrorCode.INVALID_REGISTRATION_STATUS_TRANSITION,
          });
        }
        throw error;
      }

      if (dto.status === RegistrationStatus.APPROVED) {
        const rules = this.validator.buildRules(team.tournament);
        await this.validator.validate(
          rules,
          team.members.map(toPersistedRegistrationValidationInput),
          { excludeTeamId: team.id, client: tx },
        );

        if (team.tournament.maxTeams) {
          const approved = await tx.team.count({
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
      }

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
      return { updated, notification, tournamentId: team.tournamentId };
    });

    this.notifications.emitCreated(result.notification);
    if (dto.status === RegistrationStatus.APPROVED) {
      this.events.publish({
        tournamentId: result.tournamentId,
        event: 'teamApproved',
        payload: result.updated,
      });
    }
    return result.updated;
  }

  private async lockTournament(
    tx: Prisma.TransactionClient,
    tournamentId: string,
  ) {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "tournaments" WHERE "id" = ${tournamentId} FOR UPDATE`,
    );
  }
}

function toPersistedRegistrationValidationInput(member: {
  realName: string;
  ign: string;
  inGameId: string | null;
  birthDate: Date | null;
  gender: RegistrationMemberInput['gender'] | null;
  email: string | null;
  phoneNumber: string | null;
  position: string | null;
  memberRole: MemberRole;
}): RegistrationMemberInput {
  return {
    realName: member.realName,
    ign: member.ign,
    inGameId: member.inGameId ?? undefined,
    birthDate: member.birthDate?.toISOString(),
    gender: member.gender ?? undefined,
    email: member.email ?? undefined,
    phoneNumber: member.phoneNumber ?? undefined,
    position: member.position ?? undefined,
    memberRole: member.memberRole,
  };
}
