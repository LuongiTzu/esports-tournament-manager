import { BadRequestException, ConflictException, Logger } from '@nestjs/common';
/* eslint-disable @typescript-eslint/unbound-method */
import {
  MatchActivationCondition,
  MatchOutcome,
  MatchSlot,
  MatchStatus,
  NotificationType,
  RoundFormat,
} from '@prisma/client';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentEventsService } from '../tournaments/tournament-events.service';
import { MatchQueryService } from './match-query.service';
import { MatchResultService } from './match-result.service';
import { MatchSchedulingService } from './match-scheduling.service';
import { MatchesService } from './matches.service';

function match(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1',
    teamAId: 'team-a',
    teamBId: 'team-b',
    teamA: { name: 'Alpha' },
    teamB: { name: 'Bravo' },
    scoreA: 0,
    scoreB: 0,
    status: MatchStatus.PENDING,
    isActive: true,
    activationCondition: null,
    bracketType: null,
    bracketRound: 1,
    matchNumber: 1,
    bestOf: 3,
    winnerTeamId: null,
    outcome: null,
    playedAt: null,
    scheduledAt: null,
    updatedAt: new Date('2026-08-14T00:00:00.000Z'),
    nextMatchId: null,
    nextMatchSlot: null,
    loserNextMatchId: null,
    loserNextMatchSlot: null,
    round: {
      id: 'round-1',
      name: 'Playoffs',
      format: RoundFormat.PLAYOFF,
      settings: null,
      tournamentId: 'tournament-1',
    },
    scores: [],
    _count: { scores: 0 },
    ...overrides,
  };
}

function harness(
  initial = match(),
  downstream: Record<string, Record<string, unknown>> = {},
) {
  let updateSequence = 0;
  const rows: Record<string, Record<string, unknown>> = {
    [initial.id]: { ...initial },
    ...downstream,
  };
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: initial.id }]),
    match: {
      findUnique: jest.fn(({ where }: { where: { id: string } }) =>
        Promise.resolve(rows[where.id] ?? null),
      ),
      findMany: jest.fn(async (): Promise<Array<Record<string, unknown>>> =>
        Object.values(rows).map((row) => ({
          id: row.id,
          status: row.status ?? MatchStatus.PENDING,
          isActive: row.isActive !== false,
          bracketType: row.bracketType ?? null,
          bracketRound: row.bracketRound ?? 1,
          matchNumber: row.matchNumber ?? 1,
          winnerTeamId: row.winnerTeamId ?? null,
          scheduledAt: row.scheduledAt ?? null,
          updatedAt: row.updatedAt ?? new Date('2026-08-14T00:00:00.000Z'),
          round: row.round,
        })),
      ),
      update: jest.fn(
        ({
          where,
          data,
        }: {
          where: { id: string };
          data: Record<string, unknown>;
        }) => {
          const definedData = Object.fromEntries(
            Object.entries(data).filter(([, value]) => value !== undefined),
          );
          rows[where.id] = {
            ...rows[where.id],
            ...definedData,
            updatedAt: new Date(
              Date.parse('2026-08-14T00:00:00.000Z') + ++updateSequence,
            ),
          };
          return Promise.resolve(rows[where.id]);
        },
      ),
      create: jest.fn(),
    },
    matchScore: {
      deleteMany: jest.fn(({ where }: { where: { matchId: string } }) => {
        rows[where.matchId].scores = [];
        return Promise.resolve({ count: 0 });
      }),
      createMany: jest.fn(
        ({
          data,
        }: {
          data: Array<{
            matchId: string;
            setNumber: number;
            teamAScore: number;
            teamBScore: number;
          }>;
        }) => {
          if (data.length) {
            rows[data[0].matchId].scores = data.map((score) => ({
              setNumber: score.setNumber,
              teamAScore: score.teamAScore,
              teamBScore: score.teamBScore,
            }));
          }
          return Promise.resolve({ count: data.length });
        },
      ),
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
  const events = {
    publish: jest.fn(),
  } as unknown as TournamentEventsService;
  const notifications = {
    createForMatchEvent: jest.fn().mockResolvedValue({
      recipientCount: 1,
      createdCount: 1,
      notifications: [],
    }),
  } as unknown as NotificationService;
  return {
    service: new MatchesService(
      new MatchQueryService(prisma),
      new MatchSchedulingService(prisma, events, notifications),
      new MatchResultService(prisma, events, notifications),
    ),
    tx,
    rows,
    events,
    notifications,
  };
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
    [7, ['A', 'B', 'A', 'B', 'A', 'A'], 4, 2],
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
          outcome: scoreA > scoreB ? MatchOutcome.TEAM_A : MatchOutcome.TEAM_B,
          playedAt: expect.any(Date) as Date,
        }),
      );
    },
  );

  it('accepts an enabled Round Robin draw without advancing either team', async () => {
    const { service, rows } = harness(
      match({
        nextMatchId: 'next',
        nextMatchSlot: MatchSlot.A,
        round: {
          id: 'round-robin',
          format: RoundFormat.ROUND_ROBIN,
          settings: { allowDraws: true },
          tournamentId: 'tournament-1',
        },
      }),
      {
        next: {
          id: 'next',
          status: MatchStatus.PENDING,
          teamAId: null,
          teamBId: null,
        },
      },
    );

    await service.update('match-1', {
      scoreA: 1,
      scoreB: 1,
      status: MatchStatus.COMPLETED,
    });

    expect(rows['match-1']).toEqual(
      expect.objectContaining({
        winnerTeamId: null,
        outcome: MatchOutcome.DRAW,
        status: MatchStatus.COMPLETED,
      }),
    );
    expect(rows.next).toEqual(
      expect.objectContaining({ teamAId: null, teamBId: null }),
    );
  });

  it('accepts an enabled Group Stage draw with an explicit DRAW outcome', async () => {
    const { service, rows } = harness(
      match({
        round: {
          id: 'group-stage',
          format: RoundFormat.GROUP_STAGE,
          settings: { allowDraws: true },
          tournamentId: 'tournament-1',
        },
      }),
    );

    await service.update('match-1', {
      scoreA: 1,
      scoreB: 1,
      status: MatchStatus.COMPLETED,
    });

    expect(rows['match-1']).toEqual(
      expect.objectContaining({
        winnerTeamId: null,
        outcome: MatchOutcome.DRAW,
        status: MatchStatus.COMPLETED,
      }),
    );
  });

  it('accepts a decisive Swiss result', async () => {
    const { service, rows } = harness(
      match({
        round: {
          id: 'swiss-round',
          format: RoundFormat.SWISS,
          settings: { numberOfRounds: 3, advancingTeamCount: 2 },
          tournamentId: 'tournament-1',
        },
      }),
    );

    await service.update('match-1', {
      scoreA: 2,
      scoreB: 0,
      status: MatchStatus.COMPLETED,
    });

    expect(rows['match-1']).toEqual(
      expect.objectContaining({
        winnerTeamId: 'team-a',
        outcome: MatchOutcome.TEAM_A,
        status: MatchStatus.COMPLETED,
      }),
    );
  });

  it('rejects a draw score that exceeds the best-of game count', async () => {
    const { service } = harness(
      match({
        round: {
          id: 'r1',
          format: RoundFormat.ROUND_ROBIN,
          settings: { allowDraws: true },
          tournamentId: 't1',
        },
      }),
    );

    await expect(
      service.update('match-1', {
        scoreA: 2,
        scoreB: 2,
        status: MatchStatus.COMPLETED,
      }),
    ).rejects.toThrow('Score exceeds the maximum game count');
  });

  it.each([
    [RoundFormat.ROUND_ROBIN, { allowDraws: false }],
    [RoundFormat.GROUP_STAGE, { allowDraws: false }],
    [RoundFormat.PLAYOFF, null],
    [RoundFormat.DOUBLE_ELIM, null],
    [RoundFormat.SWISS, null],
  ])('rejects a draw for %s', async (format, settings) => {
    const { service, tx } = harness(
      match({
        round: {
          id: 'round-1',
          format,
          settings,
          tournamentId: 'tournament-1',
        },
      }),
    );

    await expect(
      service.update('match-1', {
        scoreA: 1,
        scoreB: 1,
        status: MatchStatus.COMPLETED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(tx.match.update).not.toHaveBeenCalled();
  });

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

  it('auto-completes and advances through a structural loser-bracket bye', async () => {
    const source = match({
      id: 'winner-source',
      nextMatchId: 'winner-next',
      nextMatchSlot: MatchSlot.A,
      loserNextMatchId: 'loser-bye',
      loserNextMatchSlot: MatchSlot.A,
      round: {
        id: 'double-round',
        format: RoundFormat.DOUBLE_ELIM,
        settings: { grandFinalReset: false },
        tournamentId: 'tournament-1',
      },
    });
    const { service, rows } = harness(source, {
      'winner-next': match({
        id: 'winner-next',
        teamAId: null,
        teamBId: null,
      }),
      'loser-bye': match({
        id: 'loser-bye',
        teamAId: null,
        teamBId: null,
        isBye: true,
        nextMatchId: 'loser-next',
        nextMatchSlot: MatchSlot.B,
      }),
      'loser-next': match({
        id: 'loser-next',
        teamAId: null,
        teamBId: null,
      }),
    });

    await service.putScores('winner-source', games(['A', 'A']));

    expect(rows['loser-bye']).toEqual(
      expect.objectContaining({
        teamAId: 'team-b',
        status: MatchStatus.COMPLETED,
        winnerTeamId: 'team-b',
        outcome: MatchOutcome.TEAM_A,
      }),
    );
    expect(rows['loser-next']).toEqual(
      expect.objectContaining({ teamBId: 'team-b' }),
    );
  });

  it('waits for an enabled third-place match before completing Single Elimination', async () => {
    const final = match({
      id: 'playoff-final',
      teamAId: 'champion',
      teamBId: 'runner-up',
      bracketRound: 2,
      matchNumber: 1,
    });
    const { service, tx } = harness(final, {
      'third-place': match({
        id: 'third-place',
        teamAId: 'bronze',
        teamBId: 'fourth',
        bracketRound: 2,
        matchNumber: 2,
      }),
    });

    await service.putScores('playoff-final', games(['A', 'A']));
    expect(tx.round.update).not.toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'COMPLETED' } }),
    );

    await service.putScores('third-place', games(['A', 'A']));
    expect(tx.team.update).toHaveBeenCalledWith({
      where: { id: 'champion' },
      data: { finalRank: 1 },
    });
    expect(tx.round.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: 'COMPLETED' } }),
    );
  });

  it('rolls back old placements before advancing a changed winner', async () => {
    const { service, rows } = harness(
      match({
        scoreA: 2,
        scoreB: 0,
        status: MatchStatus.COMPLETED,
        winnerTeamId: 'team-a',
        outcome: MatchOutcome.TEAM_A,
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

  it('persists and broadcasts a completed score update', async () => {
    const { service, notifications, events } = harness();

    await service.putScores('match-1', games(['A', 'A']));

    expect(jest.mocked(notifications.createForMatchEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        tournamentId: 'tournament-1',
        type: NotificationType.SCORE_UPDATE,
        teamIds: ['team-a', 'team-b'],
        data: expect.objectContaining({
          kind: 'MATCH_RESULT',
          matchId: 'match-1',
          teamAName: 'Alpha',
          teamBName: 'Bravo',
          scoreA: 2,
          scoreB: 0,
        }),
        sourceKey: expect.stringContaining('match:match-1:result:') as string,
      }),
    );
    expect(jest.mocked(events.publish)).toHaveBeenCalledWith(
      expect.objectContaining({
        tournamentId: 'tournament-1',
        event: 'matchUpdated',
      }),
    );
    expect(jest.mocked(events.publish)).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'standingsUpdated' }),
    );
  });

  it('does not notify an idempotent completed-score retry and notifies a correction', async () => {
    const { service, notifications } = harness();
    const createNotification = jest.mocked(notifications.createForMatchEvent);

    await service.putScores('match-1', games(['A', 'A']));
    await service.putScores('match-1', games(['A', 'A']));
    const firstKey = createNotification.mock.calls[0][0].sourceKey;
    expect(createNotification).toHaveBeenCalledTimes(1);

    await service.putScores('match-1', games(['B', 'B']));
    const revisionKey = createNotification.mock.calls[1][0].sourceKey;

    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(revisionKey).not.toBe(firstKey);
  });

  it('does not notify identical completed scores after an unrelated match update', async () => {
    const completedScores = games(['A', 'A']).scores;
    const { service, notifications } = harness(
      match({
        scoreA: 2,
        status: MatchStatus.COMPLETED,
        winnerTeamId: 'team-a',
        playedAt: new Date('2026-08-14T01:00:00.000Z'),
        scores: completedScores,
        _count: { scores: completedScores.length },
      }),
    );
    const createNotification = jest.mocked(notifications.createForMatchEvent);

    await service.update('match-1', {
      discordLink: 'https://discord.gg/tournament-room',
    });
    await service.putScores('match-1', { scores: completedScores });

    expect(createNotification).not.toHaveBeenCalled();
  });

  it('keeps a committed result when notification persistence fails', async () => {
    const { service, notifications, rows } = harness();
    jest
      .mocked(notifications.createForMatchEvent)
      .mockRejectedValueOnce(new Error('notification database unavailable'));
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation();

    await expect(
      service.putScores('match-1', games(['A', 'A'])),
    ).resolves.toEqual(expect.objectContaining({ winnerTeamId: 'team-a' }));
    expect(rows['match-1']).toEqual(
      expect.objectContaining({
        status: MatchStatus.COMPLETED,
        winnerTeamId: 'team-a',
      }),
    );
    expect(log).toHaveBeenCalled();
    log.mockRestore();
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
  it('persists and broadcasts an actual schedule change', async () => {
    const { service, notifications, events } = harness();

    await service.update('match-1', {
      scheduledAt: '2026-08-20T10:00:00.000Z',
    });

    expect(jest.mocked(notifications.createForMatchEvent)).toHaveBeenCalledWith(
      expect.objectContaining({
        tournamentId: 'tournament-1',
        type: NotificationType.SCHEDULE_CHANGE,
        teamIds: ['team-a', 'team-b'],
        data: expect.objectContaining({
          kind: 'MATCH_SCHEDULE',
          teamAName: 'Alpha',
          teamBName: 'Bravo',
          newScheduledAt: '2026-08-20T10:00:00.000Z',
        }),
      }),
    );
    expect(jest.mocked(events.publish)).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'scheduleUpdated' }),
    );
  });

  it('does not persist or broadcast a no-op schedule update', async () => {
    const scheduledAt = new Date('2026-08-20T10:00:00.000Z');
    const { service, notifications, events } = harness(match({ scheduledAt }));

    await service.update('match-1', {
      scheduledAt: scheduledAt.toISOString(),
    });

    expect(
      jest.mocked(notifications.createForMatchEvent),
    ).not.toHaveBeenCalled();
    expect(jest.mocked(events.publish)).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: 'scheduleUpdated' }),
    );
    expect(jest.mocked(events.publish)).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'matchUpdated' }),
    );
  });

  it('does not notify the same schedule after an unrelated field changes updatedAt', async () => {
    const scheduledAt = new Date('2026-08-20T10:00:00.000Z');
    const { service, notifications, events } = harness(match({ scheduledAt }));

    await service.update('match-1', {
      discordLink: 'https://discord.gg/new-room',
    });
    jest.mocked(events.publish).mockClear();
    await service.update('match-1', {
      scheduledAt: scheduledAt.toISOString(),
    });

    expect(
      jest.mocked(notifications.createForMatchEvent),
    ).not.toHaveBeenCalled();
    expect(jest.mocked(events.publish)).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: 'scheduleUpdated' }),
    );
  });

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

  it('bulk schedules changed matches and emits one persistent/realtime notification', async () => {
    const { service, tx, notifications, events } = harness();
    tx.match.findMany.mockResolvedValue([
      {
        id: 'm1',
        matchNumber: 1,
        teamAId: 'team-a',
        teamBId: 'team-b',
        teamA: { name: 'Alpha' },
        teamB: { name: 'Bravo' },
        scheduledAt: null,
        updatedAt: new Date('2026-08-14T00:00:00.000Z'),
        round: { name: 'Group A', tournamentId: 't1' },
      },
      {
        id: 'm2',
        matchNumber: 2,
        teamAId: 'team-c',
        teamBId: 'team-d',
        teamA: { name: 'Charlie' },
        teamB: { name: 'Delta' },
        scheduledAt: null,
        updatedAt: new Date('2026-08-14T00:00:00.000Z'),
        round: { name: 'Group A', tournamentId: 't1' },
      },
    ]);

    await expect(
      service.bulkSchedule({
        matches: [
          { matchId: 'm1', scheduledAt: '2026-08-20T10:00:00.000Z' },
          { matchId: 'm2', scheduledAt: null },
        ],
      }),
    ).resolves.toEqual({ updatedCount: 2, matchIds: ['m1', 'm2'] });
    expect(tx.match.update).toHaveBeenCalledTimes(1);
    expect(
      jest.mocked(notifications.createForMatchEvent),
    ).toHaveBeenCalledTimes(1);
    expect(jest.mocked(notifications.createForMatchEvent)).toHaveBeenCalledWith(
      expect.objectContaining({ type: NotificationType.SCHEDULE_CHANGE }),
    );
    expect(jest.mocked(events.publish)).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'scheduleUpdated' }),
    );
  });

  it('does not persist or broadcast a bulk schedule no-op', async () => {
    const { service, tx, notifications, events } = harness();
    const scheduledAt = new Date('2026-08-20T10:00:00.000Z');
    tx.match.findMany.mockResolvedValue([
      {
        id: 'm1',
        scheduledAt,
        updatedAt: new Date('2026-08-14T00:00:00.000Z'),
        round: { tournamentId: 't1' },
      },
      {
        id: 'm2',
        scheduledAt: null,
        updatedAt: new Date('2026-08-14T00:00:00.000Z'),
        round: { tournamentId: 't1' },
      },
    ]);

    await expect(
      service.bulkSchedule({
        matches: [
          { matchId: 'm1', scheduledAt: scheduledAt.toISOString() },
          { matchId: 'm2', scheduledAt: null },
        ],
      }),
    ).resolves.toEqual({ updatedCount: 2, matchIds: ['m1', 'm2'] });

    expect(tx.match.update).not.toHaveBeenCalled();
    expect(
      jest.mocked(notifications.createForMatchEvent),
    ).not.toHaveBeenCalled();
    expect(jest.mocked(events.publish)).not.toHaveBeenCalledWith(
      expect.objectContaining({ event: 'scheduleUpdated' }),
    );
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
