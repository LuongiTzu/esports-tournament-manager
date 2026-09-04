import { ConflictException, NotFoundException } from '@nestjs/common';
import { RoundStatus, TournamentStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoundRemovalService } from './round-removal.service';

interface RoundFixture {
  id: string;
  tournamentId: string;
  orderIndex: number;
  status: RoundStatus;
  tournament: { status: TournamentStatus };
  _count: Record<
    'matches' | 'groups' | 'participants' | 'advancedTeams',
    number
  >;
}

function roundFixture(): RoundFixture {
  return {
    id: 'round-2',
    tournamentId: 'tournament-1',
    orderIndex: 2,
    status: RoundStatus.UPCOMING,
    tournament: { status: TournamentStatus.REGISTRATION },
    _count: {
      matches: 0,
      groups: 0,
      participants: 0,
      advancedTeams: 0,
    },
  };
}

function harness(
  options: {
    round?: ReturnType<typeof roundFixture> | null;
    downstream?: { id: string; orderIndex: number } | null;
  } = {},
) {
  const round = options.round === undefined ? roundFixture() : options.round;
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'locked' }]),
    round: {
      findUnique: jest.fn().mockResolvedValue(round),
      findFirst: jest.fn().mockResolvedValue(options.downstream ?? null),
      delete: jest.fn().mockResolvedValue({ id: 'round-2' }),
    },
  };
  const prisma = {
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  return { service: new RoundRemovalService(prisma), tx, round };
}

async function expectConflictCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected Round removal to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual(
      expect.objectContaining({ code }),
    );
  }
}

describe('RoundRemovalService', () => {
  it('deletes an unused final Round inside the locked transaction', async () => {
    const { service, tx } = harness();

    await expect(service.remove('round-2')).resolves.toEqual({
      message: 'Đã xóa vòng đấu thành công',
      roundId: 'round-2',
    });
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2);
    expect(tx.round.delete).toHaveBeenCalledWith({
      where: { id: 'round-2' },
    });
  });

  it('returns not found without attempting deletion', async () => {
    const { service, tx } = harness({ round: null });

    await expect(service.remove('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(tx.round.delete).not.toHaveBeenCalled();
  });

  it.each([
    TournamentStatus.ONGOING,
    TournamentStatus.COMPLETED,
    TournamentStatus.CANCELLED,
  ])('blocks deletion while the Tournament is %s', async (status) => {
    const round = roundFixture();
    round.tournament.status = status;
    const { service } = harness({ round });

    await expectConflictCode(
      service.remove(round.id),
      'ROUND_DELETE_TOURNAMENT_LOCKED',
    );
  });

  it('blocks deletion of a non-final Round', async () => {
    const { service } = harness({
      downstream: { id: 'round-3', orderIndex: 3 },
    });

    await expectConflictCode(
      service.remove('round-2'),
      'ROUND_DELETE_NOT_LAST',
    );
  });

  it.each(['matches', 'groups', 'participants', 'advancedTeams'] as const)(
    'blocks deletion when %s dependencies exist',
    async (dependency) => {
      const round = roundFixture();
      round._count[dependency] = 1;
      const { service, tx } = harness({ round });

      await expectConflictCode(
        service.remove(round.id),
        'ROUND_DELETE_HAS_DEPENDENCIES',
      );
      expect(tx.round.delete).not.toHaveBeenCalled();
    },
  );

  it('blocks deletion after the Round starts', async () => {
    const round = roundFixture();
    round.status = RoundStatus.ONGOING;
    const { service } = harness({ round });

    await expectConflictCode(
      service.remove(round.id),
      'ROUND_DELETE_HAS_DEPENDENCIES',
    );
  });
});
