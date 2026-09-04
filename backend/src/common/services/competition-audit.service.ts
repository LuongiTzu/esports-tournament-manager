import { Injectable } from '@nestjs/common';
import { CompetitionAuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CompetitionAuditEntry,
  CompetitionAuditWriter,
} from '../ports/competition-audit-writer';

@Injectable()
export class CompetitionAuditService implements CompetitionAuditWriter {
  constructor(private readonly prisma: PrismaService) {}

  async record(
    tx: Prisma.TransactionClient,
    entry: CompetitionAuditEntry,
  ): Promise<void> {
    await tx.competitionAuditLog.create({
      data: {
        tournamentId: entry.tournamentId,
        actorId: entry.actorId,
        action: entry.action,
        roundId: entry.roundId,
        matchId: entry.matchId,
        details: entry.details,
      },
    });
  }

  async findForTournament(
    tournamentId: string,
    query: { page?: number; limit?: number; action?: CompetitionAuditAction },
  ) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 50);
    const where = { tournamentId, action: query.action };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.competitionAuditLog.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          action: true,
          roundId: true,
          matchId: true,
          details: true,
          createdAt: true,
          actor: {
            select: { id: true, displayName: true, email: true },
          },
        },
      }),
      this.prisma.competitionAuditLog.count({ where }),
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
}
