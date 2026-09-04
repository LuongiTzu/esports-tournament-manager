/// <reference types="jest" />

import { BadRequestException } from '@nestjs/common';
import {
  BracketType,
  MatchOutcome,
  MatchStatus,
  RoundFormat,
  RoundStatus,
  TournamentStatus,
} from '@prisma/client';
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
  matchNumber: number | null;
  isBye: boolean;
  isActive: boolean;
  bracketType: BracketType | null;
  groupId: string | null;
  winnerTeamId: string | null;
  status: MatchStatus;
};

function completedIteration(teamCount: number, round = 1): StoredMatch[] {
  return Array.from({ length: Math.ceil(teamCount / 2) }, (_, index) => {
    const teamAId = `team-${index * 2 + 1}`;
    const teamBNumber = index * 2 + 2;
    const isBye = teamBNumber > teamCount;
    return {
      teamAId,
      teamBId: isBye ? null : `team-${teamBNumber}`,
      scoreA: 1,
      scoreB: 0,
      bracketRound: round,
      matchNumber: index + 1,
      isBye,
      isActive: true,
      bracketType: null,
      groupId: null,
      winnerTeamId: teamAId,
      status: MatchStatus.COMPLETED,
    };
  });
}

function harness(
  options: {
    format?: RoundFormat;
    numRounds?: number;
    automaticRounds?: boolean;
    teamCount?: number;
    matches?: StoredMatch[];
    persistError?: Error;
    roundStatus?: RoundStatus;
    tournamentStatus?: TournamentStatus;
  } = {},
) {
  const teamCount = options.teamCount ?? 4;
  const storedMatches = [...(options.matches ?? completedIteration(teamCount))];
  const teams = Array.from({ length: teamCount }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    seed: index + 1,
    registeredAt: new Date(2026, 0, index + 1),
  }));
  const createManyInputs: Array<Array<Record<string, unknown>>> = [];
  const createManyAndReturn = jest
    .fn()
    .mockImplementation(
      ({ data }: { data: Array<Record<string, unknown>> }) => {
        if (options.persistError) throw options.persistError;
        createManyInputs.push(data);
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
            isActive: true,
            bracketType: null,
            groupId: null,
            winnerTeamId: item.winnerTeamId as string | null,
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
        settings: options.automaticRounds
          ? null
          : {
              numberOfRounds: options.numRounds ?? 3,
              advancingTeamCount: 2,
            },
        bestOf: 1,
        tournamentId: 'tournament-1',
        orderIndex: 1,
        status: options.roundStatus ?? RoundStatus.ONGOING,
        tournament: {
          status: options.tournamentStatus ?? TournamentStatus.ONGOING,
        },
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
  return {
    service,
    tx,
    storedMatches,
    createManyAndReturn,
    createManyInputs,
  };
}

describe('SwissService.generateNextSwissRound', () => {
  it('persists and returns the next Swiss round', async () => {
    const { service, tx } = harness();

    const result = await service.generateNextSwissRound('round-1');

    expect(result.roundId).toBe('round-1');
    expect(result.bracketRound).toBe(2);
    expect(result.numberOfRounds).toBe(3);
    expect(result.matchCount).toBe(2);
    expect(result.matchIds).toEqual(['generated-3', 'generated-4']);
    expect(result.bye).toBeNull();
    expect(result.warnings).toEqual([]);
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
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
      matches: completedIteration(4).map((match, index) =>
        index === 0
          ? {
              ...match,
              status: MatchStatus.PENDING,
              winnerTeamId: null,
            }
          : match,
      ),
    });

    await expect(service.generateNextSwissRound('round-1')).rejects.toThrow(
      'The current Swiss iteration is not complete.',
    );
    expect(createManyAndReturn).not.toHaveBeenCalled();
  });

  it('rejects when the configured round limit has been reached', async () => {
    const { service } = harness({ numRounds: 1 });

    await expect(service.generateNextSwissRound('round-1')).rejects.toThrow(
      'All resolved Swiss iterations are complete.',
    );
  });

  it('derives the round limit from the actual team count when automatic', async () => {
    const { service } = harness({ automaticRounds: true, teamCount: 8 });

    const result = await service.generateNextSwissRound('round-1');

    expect(result.bracketRound).toBe(2);
    expect(result.numberOfRounds).toBe(3);
  });

  it('rejects when fewer than two approved teams are eligible', async () => {
    const { service, createManyAndReturn } = harness({ teamCount: 1 });

    await expect(service.generateNextSwissRound('round-1')).rejects.toThrow(
      'SWISS requires at least 2 approved teams',
    );
    expect(createManyAndReturn).not.toHaveBeenCalled();
  });

  it('persists and reports a bye for an odd team count', async () => {
    const { service, createManyInputs } = harness({ teamCount: 5 });

    const result = await service.generateNextSwissRound('round-1');

    expect(result.matchCount).toBe(3);
    expect(typeof result.bye?.matchId).toBe('string');
    expect(typeof result.bye?.teamId).toBe('string');
    expect(result.matches.filter((match) => match.isBye)).toHaveLength(1);
    expect(
      createManyInputs[0]?.some(
        (match) =>
          match.isBye === true &&
          match.outcome === MatchOutcome.TEAM_A &&
          match.teamBId === null,
      ),
    ).toBe(true);
  });

  it('propagates persistence failure from the transaction', async () => {
    const { service, storedMatches } = harness({
      persistError: new Error('simulated persistence failure'),
    });

    await expect(service.generateNextSwissRound('round-1')).rejects.toThrow(
      'simulated persistence failure',
    );
    expect(storedMatches).toHaveLength(2);
  });

  it('rejects a duplicate request without creating duplicate matches', async () => {
    const { service, createManyAndReturn } = harness();

    await service.generateNextSwissRound('round-1');
    await expect(service.generateNextSwissRound('round-1')).rejects.toThrow(
      'The current Swiss iteration is not complete.',
    );
    expect(createManyAndReturn).toHaveBeenCalledTimes(1);
  });

  it('rejects generation after the Tournament becomes immutable', async () => {
    const { service, createManyAndReturn } = harness({
      tournamentStatus: TournamentStatus.COMPLETED,
    });

    await expect(service.generateNextSwissRound('round-1')).rejects.toThrow(
      'The Tournament does not allow Swiss generation.',
    );
    expect(createManyAndReturn).not.toHaveBeenCalled();
  });
});
