import { BadRequestException, ConflictException } from '@nestjs/common';
import {
  MatchActivationCondition,
  MatchSlot,
  MatchStatus,
  RoundFormat,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MatchesService } from './matches.service';

function match(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1',
    teamAId: 'team-a',
    teamBId: 'team-b',
    scoreA: 0,
    scoreB: 0,
    status: MatchStatus.PENDING,
    isActive: true,
    activationCondition: null,
    bracketType: null,
    bestOf: 3,
    winnerTeamId: null,
    playedAt: null,
    nextMatchId: null,
    nextMatchSlot: null,
    loserNextMatchId: null,
    loserNextMatchSlot: null,
    round: {
      id: 'round-1',
      format: RoundFormat.PLAYOFF,
      tournamentId: 'tournament-1',
    },
    _count: { scores: 0 },
    ...overrides,
  };
}

function harness(
  initial = match(),
  downstream: Record<string, Record<string, unknown>> = {},
) {
  const rows: Record<string, Record<string, unknown>> = {
    [initial.id]: { ...initial },
    ...downstream,
  };
  const tx = {
    match: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(rows[where.id] ?? null),
      ),
      findMany: jest.fn(),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          rows[where.id] = { ...rows[where.id], ...data };
          return Promise.resolve(rows[where.id]);
        },
      ),
      create: jest.fn(),
    },
    matchScore: {
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    round: { findUnique: jest.fn(), update: jest.fn() },
    tournament: { update: jest.fn() },
    team: {
      findMany: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      update: jest.fn(),
    },
    group: { findFirst: jest.fn() },
  };
  const prisma = {
    match: tx.match,
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  return { service: new MatchesService(prisma), tx, rows };
}

const games = (winners: Array<'A' | 'B'>) => ({
  scores: winners.map((winner, index) => ({
    setNumber: index + 1,
    teamAScore: winner === 'A' ? 10 : 5,
    teamBScore: winner === 'B' ? 10 : 5,
  })),
});

describe('MatchesService results', () => {
  it.each([
    [1, ['A'], 1, 0],
    [3, ['A', 'B', 'A'], 2, 1],
    [5, ['B', 'A', 'B', 'B'], 1, 3],
  ] as const)(
    'calculates a completed BO%i result',
    async (bestOf, winners, scoreA, scoreB) => {
      const { service, rows } = harness(match({ bestOf }));

      await service.putScores('match-1', games([...winners]));

      expect(rows['match-1']).toEqual(
        expect.objectContaining({
          scoreA,
          scoreB,
          status: MatchStatus.COMPLETED,
          winnerTeamId: scoreA > scoreB ? 'team-a' : 'team-b',
          playedAt: expect.any(Date) as Date,
        }),
      );
    },
  );

  it('rejects an impossible score and leaves writes untouched', async () => {
    const { service, tx } = harness(match({ bestOf: 3 }));

    await expect(
      service.putScores('match-1', games(['A', 'A', 'B'])),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.matchScore.deleteMany).not.toHaveBeenCalled();
    expect(tx.match.update).not.toHaveBeenCalled();
  });

  it('advances the completed-match winner into the configured slot', async () => {
    const { service, rows } = harness(
      match({ nextMatchId: 'next', nextMatchSlot: MatchSlot.B }),
      {
        next: {
          id: 'next',
          status: MatchStatus.PENDING,
          teamAId: null,
          teamBId: null,
        },
      },
    );

    await service.putScores('match-1', games(['A', 'A']));

    expect(rows.next).toEqual(
      expect.objectContaining({ teamAId: null, teamBId: 'team-a' }),
    );
  });

  it('routes a Double Elimination loser without overwriting another slot', async () => {
    const { service, rows } = harness(
      match({
        nextMatchId: 'winner-next',
        nextMatchSlot: MatchSlot.A,
        loserNextMatchId: 'loser-next',
        loserNextMatchSlot: MatchSlot.B,
      }),
      {
        'winner-next': {
          id: 'winner-next',
          status: MatchStatus.PENDING,
          teamAId: null,
          teamBId: 'seeded-team',
        },
        'loser-next': {
          id: 'loser-next',
          status: MatchStatus.PENDING,
          teamAId: 'other-team',
          teamBId: null,
        },
      },
    );

    await service.putScores('match-1', games(['B', 'B']));

    expect(rows['winner-next']).toEqual(
      expect.objectContaining({ teamAId: 'team-b', teamBId: 'seeded-team' }),
    );
    expect(rows['loser-next']).toEqual(
      expect.objectContaining({ teamAId: 'other-team', teamBId: 'team-a' }),
    );
  });

  it('rolls back old placements before advancing a changed winner', async () => {
    const { service, rows } = harness(
      match({
        scoreA: 2,
        scoreB: 0,
        status: MatchStatus.COMPLETED,
        winnerTeamId: 'team-a',
        nextMatchId: 'next',
        nextMatchSlot: MatchSlot.A,
      }),
      {
        next: {
          id: 'next',
          status: MatchStatus.PENDING,
          teamAId: 'team-a',
          teamBId: null,
        },
      },
    );

    await service.putScores('match-1', games(['B', 'B']));

    expect(rows.next).toEqual(expect.objectContaining({ teamAId: 'team-b' }));
    expect(rows['match-1']).toEqual(
      expect.objectContaining({ winnerTeamId: 'team-b' }),
    );
  });

  it('blocks rollback when a downstream match is completed', async () => {
    const { service } = harness(
      match({
        scoreA: 2,
        status: MatchStatus.COMPLETED,
        winnerTeamId: 'team-a',
        nextMatchId: 'next',
        nextMatchSlot: MatchSlot.A,
      }),
      {
        next: {
          id: 'next',
          status: MatchStatus.COMPLETED,
          teamAId: 'team-a',
          teamBId: 'team-c',
        },
      },
    );

    await expect(
      service.putScores('match-1', games(['B', 'B'])),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  describe('Double Elimination Grand Final Reset', () => {
    const doubleElimRound = {
      id: 'double-elim-round',
      format: RoundFormat.DOUBLE_ELIM,
      tournamentId: 'tournament-1',
    };

    function grandFinal(overrides: Record<string, unknown> = {}) {
      return match({
        id: 'grand-final',
        teamAId: 'wb-champion',
        teamBId: 'lb-champion',
        nextMatchId: 'grand-final-reset',
        nextMatchSlot: MatchSlot.A,
        loserNextMatchId: 'grand-final-reset',
        loserNextMatchSlot: MatchSlot.B,
        round: doubleElimRound,
        ...overrides,
      });
    }

    function resetFinal(overrides: Record<string, unknown> = {}) {
      return match({
        id: 'grand-final-reset',
        teamAId: null,
        teamBId: null,
        isActive: false,
        activationCondition:
          MatchActivationCondition.LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL,
        round: doubleElimRound,
        ...overrides,
      });
    }

    it('does not allow an inactive reset match to be scored', async () => {
      const { service, tx } = harness(resetFinal());

      await expect(
        service.putScores('grand-final-reset', games(['A', 'A'])),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.matchScore.createMany).not.toHaveBeenCalled();
    });

    it('finishes the tournament without activating reset when the Winner Bracket champion wins', async () => {
      const { service, tx, rows } = harness(grandFinal(), {
        'grand-final-reset': resetFinal(),
      });

      await service.putScores('grand-final', games(['A', 'A']));

      expect(rows['grand-final-reset']).toEqual(
        expect.objectContaining({
          isActive: false,
          teamAId: null,
          teamBId: null,
        }),
      );
      expect(tx.team.update).toHaveBeenCalledWith({
        where: { id: 'wb-champion' },
        data: { finalRank: 1 },
      });
      expect(tx.round.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'COMPLETED' } }),
      );
      expect(tx.tournament.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'COMPLETED' } }),
      );
    });

    it('activates reset exactly once when the Loser Bracket champion wins', async () => {
      const { service, tx, rows } = harness(grandFinal(), {
        'grand-final-reset': resetFinal(),
      });

      await service.putScores('grand-final', games(['B', 'B']));
      await service.putScores('grand-final', games(['B', 'B']));

      expect(rows['grand-final-reset']).toEqual(
        expect.objectContaining({
          isActive: true,
          teamAId: 'lb-champion',
          teamBId: 'wb-champion',
        }),
      );
      expect(
        tx.match.update.mock.calls.filter(
          ([input]) => input.where.id === 'grand-final-reset',
        ),
      ).toHaveLength(1);
      expect(tx.team.update).not.toHaveBeenCalled();
    });

    it('makes the reset winner the tournament champion', async () => {
      const { service, tx } = harness(
        resetFinal({
          teamAId: 'lb-champion',
          teamBId: 'wb-champion',
          isActive: true,
        }),
      );

      await service.putScores('grand-final-reset', games(['B', 'B']));

      expect(tx.team.update).toHaveBeenCalledWith({
        where: { id: 'wb-champion' },
        data: { finalRank: 1 },
      });
      expect(tx.tournament.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: 'COMPLETED' } }),
      );
    });

    it('uses the first Grand Final as decisive when reset is disabled', async () => {
      const { service, tx } = harness(
        grandFinal({
          nextMatchId: null,
          nextMatchSlot: null,
          loserNextMatchId: null,
          loserNextMatchSlot: null,
        }),
      );

      await service.putScores('grand-final', games(['B', 'B']));

      expect(tx.team.update).toHaveBeenCalledWith({
        where: { id: 'lb-champion' },
        data: { finalRank: 1 },
      });
    });

    it('deactivates an unplayed reset when the Grand Final result changes', async () => {
      const { service, rows } = harness(
        grandFinal({
          scoreA: 0,
          scoreB: 2,
          status: MatchStatus.COMPLETED,
          winnerTeamId: 'lb-champion',
        }),
        {
          'grand-final-reset': resetFinal({
            teamAId: 'lb-champion',
            teamBId: 'wb-champion',
            isActive: true,
          }),
        },
      );

      await service.putScores('grand-final', games(['A', 'A']));

      expect(rows['grand-final-reset']).toEqual(
        expect.objectContaining({
          isActive: false,
          teamAId: null,
          teamBId: null,
        }),
      );
      expect(rows['grand-final']).toEqual(
        expect.objectContaining({ winnerTeamId: 'wb-champion' }),
      );
    });

    it('blocks Grand Final rollback after the reset has completed', async () => {
      const { service, tx } = harness(
        grandFinal({
          scoreA: 0,
          scoreB: 2,
          status: MatchStatus.COMPLETED,
          winnerTeamId: 'lb-champion',
        }),
        {
          'grand-final-reset': resetFinal({
            teamAId: 'lb-champion',
            teamBId: 'wb-champion',
            isActive: true,
            scoreA: 2,
            status: MatchStatus.COMPLETED,
            winnerTeamId: 'lb-champion',
            playedAt: new Date(),
            _count: { scores: 2 },
          }),
        },
      );

      await expect(
        service.putScores('grand-final', games(['A', 'A'])),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(tx.matchScore.deleteMany).not.toHaveBeenCalled();
    });
  });
});

describe('MatchesService organizer operations', () => {
  it('returns match details with per-game scores', async () => {
    const { service, tx } = harness();
    tx.match.findUnique.mockResolvedValue({
      id: 'match-1',
      scores: [{ setNumber: 1, teamAScore: 13, teamBScore: 8 }],
    });

    await expect(service.findOne('match-1')).resolves.toEqual(
      expect.objectContaining({
        scores: [{ setNumber: 1, teamAScore: 13, teamBScore: 8 }],
      }),
    );
    expect(tx.match.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          scores: { orderBy: { setNumber: 'asc' } },
        }) as object,
      }),
    );
  });

  it('bulk schedules matches from one tournament', async () => {
    const { service, tx } = harness();
    tx.match.findMany.mockResolvedValue([
      { id: 'm1', round: { tournamentId: 't1' } },
      { id: 'm2', round: { tournamentId: 't1' } },
    ]);

    await expect(
      service.bulkSchedule({
        matches: [
          { matchId: 'm1', scheduledAt: '2026-08-20T10:00:00.000Z' },
          { matchId: 'm2', scheduledAt: null },
        ],
      }),
    ).resolves.toEqual({ updatedCount: 2, matchIds: ['m1', 'm2'] });
    expect(tx.match.update).toHaveBeenCalledTimes(2);
  });

  it('creates a manual match using the round bestOf', async () => {
    const { service, tx } = harness();
    tx.round.findUnique.mockResolvedValue({
      id: 'round-1',
      tournamentId: 't1',
      bestOf: 3,
    });
    tx.team.findMany.mockResolvedValue([{ id: 'team-a' }, { id: 'team-b' }]);
    tx.match.create.mockResolvedValue({ id: 'manual-1' });

    await service.createManual('round-1', {
      teamAId: 'team-a',
      teamBId: 'team-b',
    });

    expect(tx.match.create).toHaveBeenCalledWith({
      data: {
        roundId: 'round-1',
        groupId: undefined,
        teamAId: 'team-a',
        teamBId: 'team-b',
        bestOf: 3,
        scheduledAt: undefined,
        discordLink: undefined,
      },
    });
  });
});
