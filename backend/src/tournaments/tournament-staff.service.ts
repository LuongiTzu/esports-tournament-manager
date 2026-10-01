import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CompetitionAuditAction } from '@prisma/client';
import {
  COMPETITION_AUDIT_WRITER,
  CompetitionAuditWriter,
  NOOP_COMPETITION_AUDIT_WRITER,
} from '../common/ports/competition-audit-writer';
import { PrismaService } from '../prisma/prisma.service';
import {
  AddTournamentStaffDto,
  UpdateTournamentStaffDto,
} from './dto/tournament-staff.dto';

const staffSelect = {
  id: true,
  role: true,
  createdAt: true,
  user: {
    select: { id: true, email: true, displayName: true, avatarUrl: true },
  },
} as const;

@Injectable()
export class TournamentStaffService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(COMPETITION_AUDIT_WRITER)
    private readonly audit: CompetitionAuditWriter = NOOP_COMPETITION_AUDIT_WRITER,
  ) {}

  list(tournamentId: string) {
    return this.prisma.tournamentStaff.findMany({
      where: { tournamentId },
      select: staffSelect,
      orderBy: [{ role: 'asc' }, { createdAt: 'asc' }],
    });
  }

  add(tournamentId: string, actorId: string, dto: AddTournamentStaffDto) {
    return this.prisma.$transaction(async (tx) => {
      const [tournament, user] = await Promise.all([
        tx.tournament.findUnique({
          where: { id: tournamentId },
          select: { organizerId: true },
        }),
        tx.user.findUnique({
          where: { email: dto.email.trim().toLowerCase() },
          select: { id: true, emailVerifiedAt: true },
        }),
      ]);
      if (!tournament) throw new NotFoundException('Tournament not found');
      if (!user || !user.emailVerifiedAt) {
        throw new NotFoundException('Verified user not found for this email');
      }
      if (user.id === tournament.organizerId) {
        throw new ConflictException(
          'The tournament owner is already an organizer',
        );
      }
      const existing = await tx.tournamentStaff.findUnique({
        where: { tournamentId_userId: { tournamentId, userId: user.id } },
        select: { id: true },
      });
      if (existing)
        throw new ConflictException('User is already on the tournament staff');

      const staff = await tx.tournamentStaff.create({
        data: { tournamentId, userId: user.id, role: dto.role },
        select: staffSelect,
      });
      await this.audit.record(tx, {
        tournamentId,
        actorId,
        action: CompetitionAuditAction.TOURNAMENT_STAFF_ADDED,
        details: { staffId: staff.id, userId: user.id, role: dto.role },
      });
      return staff;
    });
  }

  update(
    tournamentId: string,
    staffId: string,
    actorId: string,
    dto: UpdateTournamentStaffDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.tournamentStaff.findFirst({
        where: { id: staffId, tournamentId },
        select: { id: true, role: true, userId: true },
      });
      if (!current)
        throw new NotFoundException('Tournament staff member not found');
      const staff = await tx.tournamentStaff.update({
        where: { id: staffId },
        data: { role: dto.role },
        select: staffSelect,
      });
      await this.audit.record(tx, {
        tournamentId,
        actorId,
        action: CompetitionAuditAction.TOURNAMENT_STAFF_UPDATED,
        details: {
          staffId,
          userId: current.userId,
          previousRole: current.role,
          role: dto.role,
        },
      });
      return staff;
    });
  }

  remove(tournamentId: string, staffId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const current = await tx.tournamentStaff.findFirst({
        where: { id: staffId, tournamentId },
        select: { id: true, role: true, userId: true },
      });
      if (!current)
        throw new NotFoundException('Tournament staff member not found');
      await tx.tournamentStaff.delete({ where: { id: staffId } });
      await this.audit.record(tx, {
        tournamentId,
        actorId,
        action: CompetitionAuditAction.TOURNAMENT_STAFF_REMOVED,
        details: { staffId, userId: current.userId, role: current.role },
      });
      return { removed: true };
    });
  }
}
