import { BadRequestException } from '@nestjs/common';
import { MatchStatus, RoundFormat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SwissGenerator } from './generators/swiss.generator';
import { RoundSettingsService } from './round-settings.service';
import { SwissService } from './swiss.service';

type StoredMatch = {
  id?: string;
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number;
  scoreB: number;
  bracketRound: number | null;
  matchNumber?: number | null;
  isBye: boolean;
  status: MatchStatus;
};

function completedMatch(round = 1): StoredMatch {
  return {
    teamAId: 'team-1',
    teamBId: 'team-2',
    scoreA: 1,
    scoreB: 0,
    bracketRound: round,
    isBye: false,
    status: MatchStatus.COMPLETED,
  };
}

function harness(
  options: {
    format?: RoundFormat;
    numRounds?: number;
    teamCount?: number;
    matches?: StoredMatch[];
    persistError?: Error;
  } = {},
) {
  const storedMatches = [...(options.matches ?? [completedMatch()])];
  const teams = Array.from({ length: options.teamCount ?? 4 }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    seed: index + 1,
    registeredAt: new Date(2026, 0, index + 1),
  }));
  const createManyAndReturn = jest
    .fn()
    .mockImplementation(
      ({ data }: { data: Array<Record<string, unknown>> }) => {
        if (options.persistError) throw options.persistError;
        const persisted = data.map((item, index) => ({
          id: `generated-${storedMatches.length + index + 1}`,
          bracketRound: item.bracketRound,
          matchNumber: item.matchNumber,
          teamAId: item.teamAId,
          teamBId: item.teamBId,
          isBye: item.isBye,
        }));
        storedMatches.push(
          ...data.map((item, index) => ({
            id: persisted[index].id,
            teamAId: item.teamAId as string | null,
            teamBId: item.teamBId as string | null,
            scoreA: item.scoreA as number,
            scoreB: item.scoreB as number,
            bracketRound: item.bracketRound as number,
            matchNumber: item.matchNumber as number,
            isBye: item.isBye as boolean,
            status: item.status as MatchStatus,
          })),
        );
        return persisted;
      },
    );
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'round-1' }]),
    round: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'round-1',
        format: options.format ?? RoundFormat.SWISS,
        settings: { numRounds: options.numRounds ?? 3 },
        bestOf: 1,
        tournamentId: 'tournament-1',
      }),
    },
    team: { findMany: jest.fn().mockResolvedValue(teams) },
    roundTeam: { findMany: jest.fn().mockResolvedValue([]) },
    match: {
      findMany: jest.fn().mockImplementation(() => [...storedMatches]),
      createManyAndReturn,
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  const service = new SwissService(
    prisma,
    new RoundSettingsService(),
    new SwissGenerator(),
  );
  return { service, tx, storedMatches, createManyAndReturn };
}

describe('SwissService.generateNextSwissRound', () => {
  it('persists and returns the next Swiss round', async () => {
    const { service, tx } = harness();

    await expect(service.generateNextSwissRound('round-1')).resolves.toEqual(
      expect.objectContaining({
        roundId: 'round-1',
        bracketRound: 2,
        numRounds: 3,
        matchCount: 2,
        matchIds: expect.arrayContaining(['generated-2', 'generated-3']),
        bye: null,
        warnings: [],
      }),
    );
    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('rejects a non-Swiss round', async () => {
    const { service, createManyAndReturn } = harness({
      format: RoundFormat.ROUND_ROBIN,
    });

    await expect(
      service.generateNextSwissRound('round-1'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(createManyAndReturn).not.toHaveBeenCalled();
  });

  it('blocks generation while the current Swiss round is incomplete', async () => {
    const { service, createManyAndReturn } = harness({
      matches: [{ ...completedMatch(), status: MatchStatus.PENDING }],
    });

    await expect(service.generateNextSwissRound('round-1')).rejects.toThrow(
      'Current Swiss round is not completed',
    );
    expect(createManyAndReturn).not.toHaveBeenCalled();
  });

  it('rejects when the configured round limit has been reached', async () => {
    const { service } = harness({ numRounds: 1 });

    await expect(service.generateNextSwissRound('round-1')).rejects.toThrow(
      'All configured Swiss rounds are complete',
    );
  });

  it('rejects when fewer than two approved teams are eligible', async () => {
    const { service, createManyAndReturn } = harness({ teamCount: 1 });

    await expect(service.generateNextSwissRound('round-1')).rejects.toThrow(
      'SWISS requires at least 2 approved teams',
    );
    expect(createManyAndReturn).not.toHaveBeenCalled();
  });

  it('persists and reports a bye for an odd team count', async () => {
    const { service } = harness({ teamCount: 5 });

    const result = await service.generateNextSwissRound('round-1');

    expect(result.matchCount).toBe(3);
    expect(result.bye).toEqual({
      matchId: expect.any(String),
      teamId: expect.any(String),
    });
    expect(result.matches.filter((match) => match.isBye)).toHaveLength(1);
  });

  it('propagates persistence failure from the transaction', async () => {
    const { service, storedMatches } = harness({
      persistError: new Error('simulated persistence failure'),
    });

    await expect(service.generateNextSwissRound('round-1')).rejects.toThrow(
      'simulated persistence failure',
    );
    expect(storedMatches).toHaveLength(1);
  });

  it('rejects a duplicate request without creating duplicate matches', async () => {
    const { service, createManyAndReturn } = harness();

    await service.generateNextSwissRound('round-1');
    await expect(service.generateNextSwissRound('round-1')).rejects.toThrow(
      'Current Swiss round is not completed',
    );
    expect(createManyAndReturn).toHaveBeenCalledTimes(1);
  });
});
