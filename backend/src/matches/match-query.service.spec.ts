/* eslint-disable @typescript-eslint/unbound-method */
import {
  MatchStatus,
  RoundFormat,
  TournamentMode,
  TournamentStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MatchQueryService } from './match-query.service';

function matchRecord(id = 'match-1') {
  return {
    id,
    status: MatchStatus.PENDING,
    outcome: null,
    scoreA: 0,
    scoreB: 0,
    bestOf: 3,
    bracketRound: 1,
    matchNumber: 1,
    scheduledAt: new Date('2030-06-15T12:00:00.000Z'),
    playedAt: null,
    discordLink: 'https://discord.example/match',
    teamAId: 'team-1',
    teamBId: 'opponent-1',
    teamA: {
      id: 'team-1',
      name: 'My Team',
      shortName: 'MT',
      logoUrl: null,
      seed: 1,
    },
    teamB: {
      id: 'opponent-1',
      name: 'Opponent',
      shortName: 'OPP',
      logoUrl: null,
      seed: 2,
    },
    winner: null,
    round: {
      id: 'round-1',
      name: 'Playoffs',
      format: RoundFormat.PLAYOFF,
      tournament: {
        id: 'tournament-1',
        name: 'Arena Cup',
        slug: 'arena-cup',
        status: TournamentStatus.ONGOING,
        mode: TournamentMode.ONLINE,
        location: null,
        customGameName: 'Chess Blitz',
        game: {
          id: 'game-1',
          code: 'CUSTOM',
          name: 'Custom',
          iconUrl: null,
        },
      },
    },
  };
}

function harness() {
  const prisma = {
    team: { findMany: jest.fn() },
    match: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
  } as unknown as PrismaService;
  return { prisma, service: new MatchQueryService(prisma) };
}

describe('MatchQueryService.findForUser', () => {
  it('returns an empty aggregate without querying matches when the user has no approved team', async () => {
    const { prisma, service } = harness();
    jest.mocked(prisma.team.findMany).mockResolvedValue([]);

    await expect(service.findForUser('user-1', {})).resolves.toEqual({
      data: [],
      nextMatch: null,
      summary: { total: 0, pending: 0, ongoing: 0, completed: 0 },
      pagination: { page: 1, limit: 12, total: 0, totalPages: 0 },
    });
    expect(prisma.match.findMany).not.toHaveBeenCalled();
  });

  it('queries active non-BYE matches and identifies the current user teams', async () => {
    const { prisma, service } = harness();
    const match = matchRecord();
    jest
      .mocked(prisma.team.findMany)
      .mockResolvedValue([{ id: 'team-1' }, { id: 'team-2' }] as never);
    jest.mocked(prisma.match.findMany).mockResolvedValue([match] as never);
    jest.mocked(prisma.match.count).mockResolvedValue(1);
    jest.mocked(prisma.match.findFirst).mockResolvedValue(match as never);
    jest.mocked(prisma.match.groupBy).mockResolvedValue([
      { status: MatchStatus.PENDING, _count: { _all: 2 } },
      { status: MatchStatus.ONGOING, _count: { _all: 1 } },
      { status: MatchStatus.COMPLETED, _count: { _all: 4 } },
    ] as never);

    const result = await service.findForUser('user-1', {
      status: MatchStatus.PENDING,
      page: 2,
      limit: 5,
    });

    expect(jest.mocked(prisma.team.findMany).mock.calls[0][0]).toMatchObject({
      where: {
        status: 'APPROVED',
        OR: [
          { captainId: 'user-1' },
          { members: { some: { userId: 'user-1' } } },
        ],
      },
    });
    expect(jest.mocked(prisma.match.findMany).mock.calls[0][0]).toMatchObject({
      where: {
        isActive: true,
        isBye: false,
        status: MatchStatus.PENDING,
        OR: [
          { teamAId: { in: ['team-1', 'team-2'] } },
          { teamBId: { in: ['team-1', 'team-2'] } },
        ],
      },
      skip: 5,
      take: 5,
    });
    expect(result.summary).toEqual({
      total: 7,
      pending: 2,
      ongoing: 1,
      completed: 4,
    });
    expect(result.data[0]).toMatchObject({
      id: 'match-1',
      userTeamIds: ['team-1'],
      round: {
        tournament: { displayGameName: 'Chess Blitz' },
      },
    });
    expect(result.nextMatch?.id).toBe('match-1');
    expect(result.pagination).toEqual({
      page: 2,
      limit: 5,
      total: 1,
      totalPages: 1,
    });
  });
});
