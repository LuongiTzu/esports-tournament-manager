import { MatchResultReviewStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MatchResultReviewService } from './match-result-review.service';

describe('MatchResultReviewService.findForTournament', () => {
  it('scopes the page, count, and status summary to one tournament', async () => {
    const repository = {
      findMany: jest.fn().mockResolvedValue([
        {
          matchId: 'match-1',
          status: MatchResultReviewStatus.DISPUTED,
          openedAt: new Date('2030-06-15T12:00:00Z'),
          updatedAt: new Date('2030-06-15T13:00:00Z'),
          match: {
            matchNumber: 3,
            teamA: { id: 'team-a', name: 'A' },
            teamB: { id: 'team-b', name: 'B' },
            round: { id: 'round-1', name: 'Final' },
          },
        },
      ]),
      count: jest.fn().mockResolvedValue(6),
      groupBy: jest.fn().mockResolvedValue([
        { status: MatchResultReviewStatus.DISPUTED, _count: { _all: 6 } },
        {
          status: MatchResultReviewStatus.PENDING_CONFIRMATION,
          _count: { _all: 2 },
        },
        { status: MatchResultReviewStatus.RESOLVED, _count: { _all: 4 } },
      ]),
    };
    const prisma = {
      matchResultReview: repository,
    } as unknown as PrismaService;
    const service = new MatchResultReviewService(prisma);

    const result = await service.findForTournament('tournament-1', {
      page: 2,
      limit: 5,
    });

    expect(repository.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          match: { round: { tournamentId: 'tournament-1' } },
          status: MatchResultReviewStatus.DISPUTED,
        },
        skip: 5,
        take: 5,
      }),
    );
    expect(repository.count).toHaveBeenCalledWith({
      where: {
        match: { round: { tournamentId: 'tournament-1' } },
        status: MatchResultReviewStatus.DISPUTED,
      },
    });
    expect(repository.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { match: { round: { tournamentId: 'tournament-1' } } },
      }),
    );
    expect(result.data[0]).toMatchObject({
      matchId: 'match-1',
      roundId: 'round-1',
      roundName: 'Final',
      teamA: { name: 'A' },
      teamB: { name: 'B' },
    });
    expect(result.summary).toEqual({
      disputed: 6,
      pendingConfirmation: 2,
      resolved: 4,
      confirmed: 0,
    });
    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 6,
      totalPages: 2,
    });

    await service.findForTournament('tournament-1', {
      status: MatchResultReviewStatus.RESOLVED,
    });
    expect(repository.findMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: {
          match: { round: { tournamentId: 'tournament-1' } },
          status: MatchResultReviewStatus.RESOLVED,
        },
      }),
    );
  });
});
