/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  MatchStatus,
  RoundFormat,
  RoundStatus,
  TournamentStatus,
} from '@prisma/client';
import { RoundLifecycleService } from './round-lifecycle.service';
import { RoundSettingsService } from './round-settings.service';

function completedMatch(overrides: Record<string, unknown> = {}) {
  return {
    status: MatchStatus.COMPLETED,
    isActive: true,
    isBye: false,
    bracketRound: 1,
    bracketType: null,
    matchNumber: 1,
    groupId: null,
    winnerTeamId: 'team-a',
    teamAId: 'team-a',
    teamBId: 'team-b',
    scoreA: 1,
    scoreB: 0,
    playedAt: new Date('2026-09-01T00:00:00.000Z'),
    _count: { scores: 1 },
    ...overrides,
  };
}

function harness(snapshot: Record<string, unknown>) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    round: {
      findUnique: jest
        .fn()
        .mockResolvedValueOnce({
          id: 'round-1',
          tournamentId: 'tournament-1',
        })
        .mockResolvedValueOnce(snapshot),
      update: jest.fn().mockResolvedValue({}),
    },
    tournament: { update: jest.fn().mockResolvedValue({}) },
  };
  return {
    service: new RoundLifecycleService(new RoundSettingsService()),
    tx,
  };
}

describe('RoundLifecycleService', () => {
  it('completes a scoring Round and starts a registration Tournament atomically', async () => {
    const { service, tx } = harness({
      id: 'round-1',
      tournamentId: 'tournament-1',
      format: RoundFormat.ROUND_ROBIN,
      settings: {
        advancingTeamCount: 1,
        winPoints: 3,
        drawPoints: 1,
        lossPoints: 0,
        allowDraws: false,
        meetingsPerPair: 1,
      },
      status: RoundStatus.UPCOMING,
      tournament: { status: TournamentStatus.REGISTRATION },
      participants: [],
      groups: [],
      matches: [completedMatch()],
    });

    await expect(service.synchronize(tx as never, 'round-1')).resolves.toEqual(
      expect.objectContaining({
        previousStatus: RoundStatus.UPCOMING,
        status: RoundStatus.COMPLETED,
        changed: true,
        tournamentStarted: true,
        completion: expect.objectContaining({ completed: true }),
      }),
    );
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
    expect(tx.round.update).toHaveBeenCalledWith({
      where: { id: 'round-1' },
      data: { status: RoundStatus.COMPLETED },
    });
    expect(tx.tournament.update).toHaveBeenCalledWith({
      where: { id: 'tournament-1' },
      data: {
        status: TournamentStatus.ONGOING,
        registrationOpen: false,
      },
    });
  });

  it('keeps Swiss ongoing after a completed iteration when more iterations remain', async () => {
    const { service, tx } = harness({
      id: 'round-1',
      tournamentId: 'tournament-1',
      format: RoundFormat.SWISS,
      settings: { numberOfRounds: 2, advancingTeamCount: 2 },
      status: RoundStatus.UPCOMING,
      tournament: { status: TournamentStatus.ONGOING },
      participants: [
        { teamId: 'team-a' },
        { teamId: 'team-b' },
        { teamId: 'team-c' },
        { teamId: 'team-d' },
      ],
      groups: [],
      matches: [
        completedMatch(),
        completedMatch({
          matchNumber: 2,
          winnerTeamId: 'team-c',
          teamAId: 'team-c',
          teamBId: 'team-d',
        }),
      ],
    });

    await expect(service.synchronize(tx as never, 'round-1')).resolves.toEqual(
      expect.objectContaining({
        status: RoundStatus.ONGOING,
        tournamentStarted: false,
        completion: expect.objectContaining({
          completed: false,
          code: 'SWISS_ITERATIONS_PENDING',
          currentSwissIteration: 1,
          resolvedSwissIterations: 2,
        }),
      }),
    );
    expect(tx.round.update).toHaveBeenCalledWith({
      where: { id: 'round-1' },
      data: { status: RoundStatus.ONGOING },
    });
    expect(tx.tournament.update).not.toHaveBeenCalled();
  });

  it('does not write status when an ungenerated Round remains upcoming', async () => {
    const { service, tx } = harness({
      id: 'round-1',
      tournamentId: 'tournament-1',
      format: RoundFormat.PLAYOFF,
      settings: { thirdPlaceMatch: false },
      status: RoundStatus.UPCOMING,
      tournament: { status: TournamentStatus.REGISTRATION },
      participants: [],
      groups: [],
      matches: [],
    });

    await expect(service.synchronize(tx as never, 'round-1')).resolves.toEqual(
      expect.objectContaining({
        status: RoundStatus.UPCOMING,
        changed: false,
        tournamentStarted: false,
      }),
    );
    expect(tx.round.update).not.toHaveBeenCalled();
    expect(tx.tournament.update).not.toHaveBeenCalled();
  });
});
