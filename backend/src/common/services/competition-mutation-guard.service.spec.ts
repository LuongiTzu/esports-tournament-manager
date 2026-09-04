import { ConflictException, NotFoundException } from '@nestjs/common';
import { CompetitionMutationGuardService } from './competition-mutation-guard.service';

function client(
  options: {
    firstRound?: { id: string; matches: number; groups: number } | null;
    targetRound?: { id: string; matches: number; groups: number } | null;
  } = {},
) {
  const toRecord = (
    value: { id: string; matches: number; groups: number } | null | undefined,
  ) =>
    value === null
      ? null
      : {
          id: value?.id ?? 'round-1',
          _count: {
            matches: value?.matches ?? 0,
            groups: value?.groups ?? 0,
          },
        };
  return {
    round: {
      findFirst: jest.fn().mockResolvedValue(toRecord(options.firstRound)),
      findUnique: jest.fn().mockResolvedValue(toRecord(options.targetRound)),
    },
  };
}

async function expectConflictCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected competition mutation to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual(
      expect.objectContaining({ code }),
    );
  }
}

describe('CompetitionMutationGuardService', () => {
  const service = new CompetitionMutationGuardService();

  it('allows participant changes before the first structure exists', async () => {
    await expect(
      service.assertParticipantSetMutable(client() as never, 'tournament-1'),
    ).resolves.toBeUndefined();
  });

  it.each([
    { matches: 1, groups: 0 },
    { matches: 0, groups: 1 },
  ])('locks participants when first-Round structure exists', async (counts) => {
    await expectConflictCode(
      service.assertParticipantSetMutable(
        client({
          firstRound: { id: 'round-1', ...counts },
        }) as never,
        'tournament-1',
      ),
      'TOURNAMENT_PARTICIPANTS_LOCKED',
    );
  });

  it('allows seed changes before the target Round structure exists', async () => {
    await expect(
      service.assertRoundSeedsMutable(client() as never, 'round-1'),
    ).resolves.toBeUndefined();
  });

  it('locks seeds after the target Round is generated', async () => {
    await expectConflictCode(
      service.assertRoundSeedsMutable(
        client({
          targetRound: { id: 'round-1', matches: 1, groups: 0 },
        }) as never,
        'round-1',
      ),
      'ROUND_SEEDS_LOCKED',
    );
  });

  it('reports a missing target Round while checking seeds', async () => {
    await expect(
      service.assertRoundSeedsMutable(
        client({ targetRound: null }) as never,
        'missing',
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
