import { CompetitionAuditAction, Prisma } from '@prisma/client';

export const COMPETITION_AUDIT_WRITER = Symbol('COMPETITION_AUDIT_WRITER');

export interface CompetitionAuditEntry {
  tournamentId: string;
  actorId?: string;
  action: CompetitionAuditAction;
  roundId?: string;
  matchId?: string;
  details?: Prisma.InputJsonValue;
}

export interface CompetitionAuditWriter {
  record(
    tx: Prisma.TransactionClient,
    entry: CompetitionAuditEntry,
  ): Promise<void>;
}

export const NOOP_COMPETITION_AUDIT_WRITER: CompetitionAuditWriter = {
  async record() {},
};
