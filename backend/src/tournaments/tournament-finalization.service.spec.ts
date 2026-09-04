/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { RoundFormat, RoundStatus, TournamentStatus } from '@prisma/client';
import { RoundParticipantResolver } from '../brackets/round-participant-resolver.service';
import { RoundSettingsService } from '../brackets/round-settings.service';
import { StandingsService } from '../brackets/standings.service';
import type { NotificationPublisher } from '../common/ports/notification-publisher';
import type { TournamentEventPublisher } from '../common/ports/tournament-event-publisher';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentFinalizationService } from './tournament-finalization.service';

const teams = [
  { id: 'team-a', name: 'Alpha', seed: 1, registeredAt: new Date() },
  { id: 'team-b', name: 'Bravo', seed: 2, registeredAt: new Date() },
];

function round(overrides: Record<string, unknown> = {}) {
  return {
    id: 'round-final',
    name: 'League',
    tournamentId: 'tournament-1',
    orderIndex: 1,
    format: RoundFormat.ROUND_ROBIN,
    status: RoundStatus.ONGOING,
    settings: {
      advancingTeamCount: 1,
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      allowDraws: false,
      meetingsPerPair: 1,
    },
    matches: [
      {
        status: 'COMPLETED',
        isActive: true,
        isBye: false,
        bracketRound: 1,
        bracketType: null,
        matchNumber: 1,
        groupId: null,
        winnerTeamId: 'team-a',
      },
    ],
    ...overrides,
  };
}

function harness(options?: {
  tournamentStatus?: TournamentStatus;
  finalRound?: ReturnType<typeof round> | null;
  standingTeamIds?: string[];
}) {
  const finalRound =
    options?.finalRound === undefined ? round() : options.finalRound;
  const standingTeamIds = options?.standingTeamIds ?? ['team-a', 'team-b'];
  const rankedTeams = standingTeamIds.map((id, index) => ({
    id,
    name: id === 'team-a' ? 'Alpha' : 'Bravo',
    shortName: null,
    logoUrl: null,
    seed: index + 1,
    finalRank: index + 1,
  }));
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    tournament: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'tournament-1',
        status: options?.tournamentStatus ?? TournamentStatus.ONGOING,
      }),
      update: jest.fn().mockResolvedValue({}),
    },
    round: {
      findFirst: jest.fn().mockResolvedValue(finalRound),
      update: jest.fn().mockResolvedValue({}),
    },
    team: {
      updateMany: jest.fn().mockResolvedValue({ count: 2 }),
      update: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue(rankedTeams),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  const settings = {
    getEffectiveSettings: jest.fn().mockReturnValue(finalRound?.settings),
  } as unknown as RoundSettingsService;
  const participants = {
    resolveForGeneration: jest.fn().mockResolvedValue({
      source: 'APPROVED_TEAMS',
      teams,
    }),
  } as unknown as RoundParticipantResolver;
  const standings = {
    forTournament: jest.fn().mockResolvedValue({
      tournamentId: 'tournament-1',
      rounds: [
        {
          roundId: 'round-final',
          format: RoundFormat.ROUND_ROBIN,
          standings: standingTeamIds.map((id, index) => ({
            id,
            name: id === 'team-a' ? 'Alpha' : 'Bravo',
            seed: index + 1,
            rank: index + 1,
            points: 3 - index * 3,
            wins: 1 - index,
            scoreDifference: 2 - index * 4,
          })),
        },
      ],
    }),
  } as unknown as StandingsService;
  const events = {
    publish: jest.fn(),
  } as unknown as TournamentEventPublisher;
  const notifications = {
    createForTournamentEvent: jest.fn().mockResolvedValue(undefined),
  } as unknown as NotificationPublisher;
  return {
    service: new TournamentFinalizationService(
      prisma,
      settings,
      participants,
      standings,
      events,
      notifications,
    ),
    prisma,
    tx,
    standings,
    events,
    notifications,
  };
}

describe('TournamentFinalizationService', () => {
  it('persists every final rank and completes a terminal standings Round atomically', async () => {
    const { service, prisma, tx, events, notifications } = harness();

    await expect(
      service.confirmFinalStandings('tournament-1'),
    ).resolves.toMatchObject({
      status: TournamentStatus.COMPLETED,
      champion: { id: 'team-a', finalRank: 1 },
      finalStandings: [
        { id: 'team-a', finalRank: 1 },
        { id: 'team-b', finalRank: 2 },
      ],
    });

    expect(prisma.$transaction).toHaveBeenCalledWith(
      expect.any(Function),
      expect.objectContaining({ isolationLevel: 'Serializable' }),
    );
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
    expect(tx.team.updateMany).toHaveBeenCalledWith({
      where: { tournamentId: 'tournament-1' },
      data: { finalRank: null },
    });
    expect(tx.team.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'team-a' },
      data: { finalRank: 1 },
    });
    expect(tx.team.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'team-b' },
      data: { finalRank: 2 },
    });
    expect(tx.round.update).toHaveBeenCalledWith({
      where: { id: 'round-final' },
      data: { status: RoundStatus.COMPLETED },
    });
    expect(tx.tournament.update).toHaveBeenCalledWith({
      where: { id: 'tournament-1' },
      data: {
        status: TournamentStatus.COMPLETED,
        registrationOpen: false,
      },
    });
    expect(events.publish).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'standingsUpdated' }),
    );
    expect(notifications.createForTournamentEvent).toHaveBeenCalled();
  });

  it('rejects finalization until the complete structure is resolved', async () => {
    const pending = round({
      matches: [
        {
          ...round().matches[0],
          status: 'PENDING',
          winnerTeamId: null,
        },
      ],
    });
    const { service, tx } = harness({ finalRound: pending });

    await expect(
      service.confirmFinalStandings('tournament-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'TOURNAMENT_FINALIZATION_NOT_READY',
      }),
    });
    expect(tx.team.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a terminal Group Stage instead of guessing one champion', async () => {
    const { service, tx } = harness({
      finalRound: round({ format: RoundFormat.GROUP_STAGE }),
    });

    await expect(
      service.confirmFinalStandings('tournament-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'TOURNAMENT_FINALIZATION_UNSUPPORTED_FORMAT',
      }),
    });
    expect(tx.team.updateMany).not.toHaveBeenCalled();
  });

  it('rejects a standings snapshot that does not exactly match participants', async () => {
    const { service, tx } = harness({ standingTeamIds: ['team-a'] });

    await expect(
      service.confirmFinalStandings('tournament-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'TOURNAMENT_FINALIZATION_STANDINGS_INVALID',
      }),
    });
    expect(tx.team.updateMany).not.toHaveBeenCalled();
  });

  it('requires and validates an organizer decision when first place is tied', async () => {
    const { service, standings, tx } = harness();
    jest.mocked(standings.forTournament).mockResolvedValue({
      tournamentId: 'tournament-1',
      rounds: [
        {
          roundId: 'round-final',
          format: RoundFormat.ROUND_ROBIN,
          standings: [
            {
              id: 'team-a',
              name: 'Alpha',
              seed: 1,
              points: 3,
              wins: 1,
              scoreDifference: 2,
            },
            {
              id: 'team-b',
              name: 'Bravo',
              seed: 2,
              points: 3,
              wins: 1,
              scoreDifference: 2,
            },
          ],
        },
      ],
    });

    await expect(
      service.confirmFinalStandings('tournament-1'),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'TOURNAMENT_CHAMPION_TIE_BREAK_REQUIRED',
        details: {
          candidates: [
            { teamId: 'team-a', name: 'Alpha', seed: 1 },
            { teamId: 'team-b', name: 'Bravo', seed: 2 },
          ],
        },
      }),
    });
    expect(tx.team.updateMany).not.toHaveBeenCalled();

    await expect(
      service.confirmFinalStandings('tournament-1', 'team-b'),
    ).resolves.toMatchObject({ status: TournamentStatus.COMPLETED });
    expect(tx.team.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'team-b' },
      data: { finalRank: 1 },
    });
  });
});
