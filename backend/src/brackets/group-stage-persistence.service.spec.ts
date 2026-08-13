import { describe, expect, it, jest } from '@jest/globals';
import { RoundFormat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { GroupStageGenerator } from './generators/group-stage.generator';
import { RoundRobinGenerator } from './generators/round-robin.generator';
import { GroupStagePersistenceService } from './group-stage-persistence.service';
import { RoundSettingsService } from './round-settings.service';

interface StoredGroup {
  id: string;
  roundId: string;
  name: string;
  orderIndex: number;
}

interface FakeState {
  groups: StoredGroup[];
  assignments: Array<{ groupId: string; teamId: string }>;
  matches: Array<Record<string, unknown>>;
}

function teamRows(count: number) {
  return Array.from({ length: count }, (_, index) => ({
    id: `team-${index + 1}`,
    name: `Team ${index + 1}`,
    seed: index + 1,
    registeredAt: new Date(2026, 0, index + 1),
  }));
}

function fakePrisma(failOnGroup?: number) {
  let state: FakeState = { groups: [], assignments: [], matches: [] };
  const prisma = {
    $transaction: jest.fn(
      async (callback: (tx: unknown) => Promise<unknown>) => {
        const working: FakeState = structuredClone(state);
        const tx = {
          round: {
            findUnique: jest.fn(() =>
              Promise.resolve({
                id: 'round-1',
                format: RoundFormat.GROUP_STAGE,
                settings: {
                  numGroups: 2,
                  teamsPerGroup: 4,
                  advanceCount: 2,
                  doubleRound: false,
                },
                bestOf: 3,
                tournamentId: 'tournament-1',
              }),
            ),
          },
          group: {
            count: jest.fn(() => Promise.resolve(working.groups.length)),
            create: jest.fn(({ data }: { data: Omit<StoredGroup, 'id'> }) => {
              const group = {
                id: `group-db-${working.groups.length + 1}`,
                ...data,
              };
              working.groups.push(group);
              return {
                id: group.id,
                name: group.name,
                orderIndex: group.orderIndex,
              };
            }),
          },
          match: {
            count: jest.fn(() => Promise.resolve(working.matches.length)),
            createMany: jest.fn(
              ({ data }: { data: Array<Record<string, unknown>> }) => {
                const groupNumber = working.groups.length;
                if (failOnGroup === groupNumber)
                  throw new Error('simulated match failure');
                working.matches.push(...data);
                return { count: data.length };
              },
            ),
          },
          team: { findMany: jest.fn(() => Promise.resolve(teamRows(8))) },
          groupTeam: {
            createMany: jest.fn(
              ({
                data,
              }: {
                data: Array<{ groupId: string; teamId: string }>;
              }) => {
                working.assignments.push(...data);
                return { count: data.length };
              },
            ),
          },
        };

        const result = await callback(tx);
        state = working;
        return result;
      },
    ),
  };

  return { prisma: prisma as unknown as PrismaService, getState: () => state };
}

describe('GroupStagePersistenceService', () => {
  function service(prisma: PrismaService) {
    return new GroupStagePersistenceService(
      prisma,
      new RoundSettingsService(),
      new GroupStageGenerator(new RoundRobinGenerator()),
    );
  }

  it('atomically persists Group, GroupTeam and Match data', async () => {
    const fake = fakePrisma();

    await expect(service(fake.prisma).generate('round-1')).resolves.toEqual(
      expect.objectContaining({ groupCount: 2, matchCount: 12 }),
    );

    const state = fake.getState();
    expect(state.groups).toHaveLength(2);
    expect(state.assignments).toHaveLength(8);
    expect(state.matches).toHaveLength(12);
    expect(new Set(state.matches.map((match) => match.groupId)).size).toBe(2);
    expect(state.matches.every((match) => match.roundId === 'round-1')).toBe(
      true,
    );
  });

  it('rolls back every write when one group fails', async () => {
    const fake = fakePrisma(2);

    await expect(service(fake.prisma).generate('round-1')).rejects.toThrow(
      'simulated match failure',
    );

    expect(fake.getState()).toEqual({
      groups: [],
      assignments: [],
      matches: [],
    });
  });
});
