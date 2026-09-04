import { CompetitionAuditAction } from '@prisma/client';
import { CompetitionAuditService } from './competition-audit.service';

describe('CompetitionAuditService', () => {
  it('persists an audit entry through the caller transaction', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const service = new CompetitionAuditService({} as never);

    await service.record({ competitionAuditLog: { create } } as never, {
      tournamentId: 'tournament-1',
      actorId: 'user-1',
      action: CompetitionAuditAction.MATCH_RESULT_CORRECTED,
      roundId: 'round-1',
      matchId: 'match-1',
      details: { scoreA: 2, scoreB: 1 },
    });

    expect(create).toHaveBeenCalledWith({
      data: {
        tournamentId: 'tournament-1',
        actorId: 'user-1',
        action: CompetitionAuditAction.MATCH_RESULT_CORRECTED,
        roundId: 'round-1',
        matchId: 'match-1',
        details: { scoreA: 2, scoreB: 1 },
      },
    });
  });

  it('returns a bounded, newest-first page filtered by action', async () => {
    const rows = [{ id: 'audit-2' }];
    const findMany = jest.fn().mockReturnValue('find-query');
    const count = jest.fn().mockReturnValue('count-query');
    const prisma = {
      competitionAuditLog: { findMany, count },
      $transaction: jest.fn().mockResolvedValue([rows, 51]),
    };
    const service = new CompetitionAuditService(prisma as never);

    await expect(
      service.findForTournament('tournament-1', {
        page: 2,
        limit: 999,
        action: CompetitionAuditAction.DOWNSTREAM_RESET,
      }),
    ).resolves.toEqual({
      data: rows,
      pagination: { page: 2, limit: 50, total: 51, totalPages: 2 },
    });
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tournamentId: 'tournament-1',
          action: CompetitionAuditAction.DOWNSTREAM_RESET,
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: 50,
        take: 50,
      }),
    );
    expect(count).toHaveBeenCalledWith({
      where: {
        tournamentId: 'tournament-1',
        action: CompetitionAuditAction.DOWNSTREAM_RESET,
      },
    });
  });
});
