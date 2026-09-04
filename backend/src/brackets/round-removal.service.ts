import {
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  CompetitionAuditAction,
  Prisma,
  RoundStatus,
  TournamentStatus,
} from '@prisma/client';
import { ApplicationErrorCode } from '../common/errors/application-error-code';
import {
  COMPETITION_AUDIT_WRITER,
  CompetitionAuditWriter,
  NOOP_COMPETITION_AUDIT_WRITER,
} from '../common/ports/competition-audit-writer';
import { PrismaService } from '../prisma/prisma.service';

const ROUND_MUTABLE_TOURNAMENT_STATUSES: readonly TournamentStatus[] = [
  TournamentStatus.DRAFT,
  TournamentStatus.REGISTRATION,
];

/** Transactional guard for deleting an unused final Tournament Round. */
@Injectable()
export class RoundRemovalService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(COMPETITION_AUDIT_WRITER)
    private readonly audit: CompetitionAuditWriter = NOOP_COMPETITION_AUDIT_WRITER,
  ) {}

  async remove(roundId: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const reference = await tx.round.findUnique({
        where: { id: roundId },
        select: { id: true, tournamentId: true },
      });
      if (!reference) throw new NotFoundException('Không tìm thấy vòng đấu');

      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "tournaments" WHERE "id" = ${reference.tournamentId} FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "rounds" WHERE "id" = ${roundId} FOR UPDATE`,
      );

      const round = await tx.round.findUnique({
        where: { id: roundId },
        select: {
          id: true,
          tournamentId: true,
          orderIndex: true,
          status: true,
          tournament: { select: { status: true } },
          _count: {
            select: {
              matches: true,
              groups: true,
              participants: true,
              advancedTeams: true,
            },
          },
        },
      });
      if (!round || round.tournamentId !== reference.tournamentId) {
        throw new ConflictException({
          code: ApplicationErrorCode.ROUND_DELETE_STATE_CHANGED,
          message: 'Round changed while deletion was being validated',
        });
      }
      if (
        !ROUND_MUTABLE_TOURNAMENT_STATUSES.includes(round.tournament.status)
      ) {
        throw new ConflictException({
          code: ApplicationErrorCode.ROUND_DELETE_TOURNAMENT_LOCKED,
          message:
            'Rounds can only be deleted while the tournament is in draft or registration',
        });
      }
      if (round.status !== RoundStatus.UPCOMING) {
        throw new ConflictException({
          code: ApplicationErrorCode.ROUND_DELETE_HAS_DEPENDENCIES,
          message: 'A started or completed Round cannot be deleted',
        });
      }

      const downstream = await tx.round.findFirst({
        where: {
          tournamentId: round.tournamentId,
          orderIndex: { gt: round.orderIndex },
        },
        orderBy: { orderIndex: 'asc' },
        select: { id: true, orderIndex: true },
      });
      if (downstream) {
        throw new ConflictException({
          code: ApplicationErrorCode.ROUND_DELETE_NOT_LAST,
          message: 'Only the final configured Round can be deleted',
        });
      }

      const dependencies = round._count;
      if (Object.values(dependencies).some((count) => count > 0)) {
        throw new ConflictException({
          code: ApplicationErrorCode.ROUND_DELETE_HAS_DEPENDENCIES,
          message:
            'Cannot delete a Round with matches, groups, participants, or advancement data',
        });
      }

      await tx.round.delete({ where: { id: roundId } });
      await this.audit.record(tx, {
        tournamentId: round.tournamentId,
        actorId,
        action: CompetitionAuditAction.ROUND_DELETED,
        roundId,
        details: { orderIndex: round.orderIndex },
      });
      return { message: 'Đã xóa vòng đấu thành công', roundId };
    });
  }
}
