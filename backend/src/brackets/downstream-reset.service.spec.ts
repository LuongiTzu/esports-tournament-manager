/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { MatchStatus, RoundStatus, TournamentStatus } from '@prisma/client';
import { ApplicationErrorCode } from '../common/errors/application-error-code';
import { TournamentEventPublisher } from '../common/ports/tournament-event-publisher';
import { PrismaService } from '../prisma/prisma.service';
import { DownstreamResetService } from './downstream-reset.service';

function harness(options?: {
  tournamentStatus?: TournamentStatus;
  downstreamRounds?: ReturnType<typeof downstreamRound>[];
  finalRankedTeamCount?: number;
}) {
  const sourceRound = {
    id: 'round-source',
    name: 'Group stage',
    orderIndex: 1,
    status: RoundStatus.COMPLETED,
    tournamentId: 'tournament-1',
    tournament: {
      id: 'tournament-1',
      status: options?.tournamentStatus ?? TournamentStatus.COMPLETED,
      updatedAt: new Date('2026-09-03T00:00:00.000Z'),
    },
  };
  const rounds = options?.downstreamRounds ?? [downstreamRound()];
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    round: {
      findUnique: jest.fn().mockResolvedValue(sourceRound),
      findMany: jest.fn().mockResolvedValue(rounds),
      updateMany: jest.fn().mockResolvedValue({ count: rounds.length }),
    },
    roundTeam: {
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    match: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    group: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
    team: {
      count: jest.fn().mockResolvedValue(options?.finalRankedTeamCount ?? 2),
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
    },
    tournament: {
      update: jest.fn().mockResolvedValue({ id: 'tournament-1' }),
    },
  };
  const prisma = {
    ...tx,
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  const events = { publish: jest.fn() } as TournamentEventPublisher;
  return {
    service: new DownstreamResetService(prisma, events),
    tx,
    events,
  };
}

function downstreamRound() {
  return {
    id: 'round-final',
    name: 'Final',
    orderIndex: 2,
    status: RoundStatus.COMPLETED,
    updatedAt: new Date('2026-09-03T01:00:00.000Z'),
    matches: [
      {
        id: 'match-final',
        status: MatchStatus.COMPLETED,
        scoreA: 1,
        scoreB: 0,
        winnerTeamId: 'team-1',
        playedAt: new Date('2026-09-03T01:30:00.000Z'),
        updatedAt: new Date('2026-09-03T01:30:00.000Z'),
        _count: { scores: 1 },
      },
    ],
    groups: [{ id: 'group-final' }],
    participants: [
      {
        teamId: 'team-1',
        advancedFromRoundId: 'round-source',
        seed: 1,
        createdAt: new Date('2026-09-03T00:30:00.000Z'),
      },
    ],
  };
}

describe('DownstreamResetService', () => {
  it('previews the complete destructive impact without writing', async () => {
    const { service, tx } = harness();

    await expect(service.preview('round-source')).resolves.toEqual(
      expect.objectContaining({
        previewToken: expect.stringMatching(/^[a-f0-9]{64}$/),
        impact: {
          roundCount: 1,
          matchCount: 1,
          completedMatchCount: 1,
          progressedMatchCount: 1,
          groupCount: 1,
          participantAssignmentCount: 1,
          finalRankedTeamCount: 2,
        },
      }),
    );
    expect(tx.match.deleteMany).not.toHaveBeenCalled();
  });

  it('resets every downstream structure atomically and reopens completion', async () => {
    const { service, tx, events } = harness();
    const preview = await service.preview('round-source');

    await expect(
      service.reset('round-source', preview.previewToken),
    ).resolves.toEqual(
      expect.objectContaining({ tournamentStatus: TournamentStatus.ONGOING }),
    );
    expect(tx.$queryRaw).toHaveBeenCalledTimes(4);
    expect(tx.roundTeam.deleteMany).toHaveBeenCalledWith({
      where: { roundId: { in: ['round-final'] } },
    });
    expect(tx.match.deleteMany).toHaveBeenCalled();
    expect(tx.group.deleteMany).toHaveBeenCalled();
    expect(tx.round.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ['round-final'] } },
      data: { status: RoundStatus.UPCOMING },
    });
    expect(tx.team.updateMany).toHaveBeenCalledWith({
      where: { tournamentId: 'tournament-1', finalRank: { not: null } },
      data: { finalRank: null },
    });
    expect(tx.tournament.update).toHaveBeenCalledWith({
      where: { id: 'tournament-1' },
      data: { status: TournamentStatus.ONGOING },
    });
    expect(events.publish).toHaveBeenCalledWith({
      tournamentId: 'tournament-1',
      event: 'standingsUpdated',
      payload: { sourceRoundId: 'round-source', downstreamReset: true },
    });
  });

  it('rejects a stale preview before deleting anything', async () => {
    const { service, tx } = harness();

    await expect(
      service.reset('round-source', '0'.repeat(64)),
    ).rejects.toMatchObject({
      response: { code: ApplicationErrorCode.DOWNSTREAM_RESET_PREVIEW_STALE },
    });
    expect(tx.match.deleteMany).not.toHaveBeenCalled();
  });

  it('rejects a source without downstream data', async () => {
    const { service } = harness({
      tournamentStatus: TournamentStatus.ONGOING,
      downstreamRounds: [],
      finalRankedTeamCount: 0,
    });

    await expect(service.preview('round-source')).rejects.toMatchObject({
      response: { code: ApplicationErrorCode.DOWNSTREAM_RESET_NOT_AVAILABLE },
    });
  });
});
