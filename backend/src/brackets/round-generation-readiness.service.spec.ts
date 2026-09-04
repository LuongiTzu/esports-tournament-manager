import { ConflictException } from '@nestjs/common';
import { MatchStatus, RoundFormat, TournamentStatus } from '@prisma/client';
import { RoundGenerationReadinessService } from './round-generation-readiness.service';

const target = {
  id: 'round-2',
  tournamentId: 'tournament-1',
  orderIndex: 2,
};

interface PreviousRoundFixture {
  id: string;
  orderIndex: number;
  format: RoundFormat;
  settings: Record<string, unknown>;
  participants: Array<{ teamId: string }>;
  groups: Array<{
    id: string;
    teamAssignments: Array<{ teamId: string }>;
  }>;
  matches: Array<{
    status: MatchStatus;
    isActive: boolean;
    isBye: boolean;
    bracketRound: number | null;
    bracketType: null;
    matchNumber: number | null;
    groupId: string | null;
    winnerTeamId: string | null;
    teamAId: string | null;
    teamBId: string | null;
  }>;
}

function completedRoundRobin(): PreviousRoundFixture {
  return {
    id: 'round-1',
    orderIndex: 1,
    format: RoundFormat.ROUND_ROBIN,
    settings: {
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      allowDraws: false,
      meetingsPerPair: 1,
    },
    participants: [],
    groups: [],
    matches: [
      {
        status: MatchStatus.COMPLETED,
        isActive: true,
        isBye: false,
        bracketRound: 1,
        bracketType: null,
        matchNumber: 1,
        groupId: null,
        winnerTeamId: 'team-1',
        teamAId: 'team-1',
        teamBId: 'team-2',
      },
    ],
  };
}

function harness(
  overrides: {
    tournament?: { status: TournamentStatus; registrationOpen: boolean } | null;
    previous?: PreviousRoundFixture | null;
  } = {},
) {
  const tx = {
    $queryRaw: jest.fn().mockResolvedValue([{ id: 'round-1' }]),
    tournament: {
      findUnique: jest.fn().mockResolvedValue(
        overrides.tournament === undefined
          ? {
              status: TournamentStatus.REGISTRATION,
              registrationOpen: false,
            }
          : overrides.tournament,
      ),
    },
    round: {
      findFirst: jest
        .fn()
        .mockResolvedValue(
          overrides.previous === undefined
            ? completedRoundRobin()
            : overrides.previous,
        ),
      findUnique: jest
        .fn()
        .mockResolvedValue(
          overrides.previous === undefined
            ? completedRoundRobin()
            : overrides.previous,
        ),
    },
  };
  return { service: new RoundGenerationReadinessService(), tx };
}

async function expectConflictCode(
  promise: Promise<unknown>,
  code: string,
): Promise<void> {
  try {
    await promise;
    throw new Error('Expected generation readiness to reject');
  } catch (error) {
    expect(error).toBeInstanceOf(ConflictException);
    expect((error as ConflictException).getResponse()).toEqual(
      expect.objectContaining({ code }),
    );
  }
}

describe('RoundGenerationReadinessService', () => {
  it('allows the first Round only after registration is closed', async () => {
    const { service, tx } = harness();

    await expect(
      service.assertCanGenerate(tx as never, { ...target, orderIndex: 1 }),
    ).resolves.toBeUndefined();
    expect(tx.round.findFirst).not.toHaveBeenCalled();
  });

  it('blocks first-Round generation while registration is open', async () => {
    const { service, tx } = harness({
      tournament: {
        status: TournamentStatus.REGISTRATION,
        registrationOpen: true,
      },
    });

    await expectConflictCode(
      service.assertCanGenerate(tx as never, { ...target, orderIndex: 1 }),
      'REGISTRATION_MUST_BE_CLOSED',
    );
  });

  it.each([
    TournamentStatus.DRAFT,
    TournamentStatus.COMPLETED,
    TournamentStatus.CANCELLED,
  ])('blocks generation when the tournament is %s', async (status) => {
    const { service, tx } = harness({
      tournament: { status, registrationOpen: false },
    });

    await expectConflictCode(
      service.assertCanGenerate(tx as never, target),
      'TOURNAMENT_NOT_MUTABLE',
    );
  });

  it('requires an immediately preceding Round', async () => {
    const previous = completedRoundRobin();
    previous.orderIndex = 1;
    const { service, tx } = harness({ previous });

    await expectConflictCode(
      service.assertCanGenerate(tx as never, { ...target, orderIndex: 3 }),
      'ROUND_SEQUENCE_INVALID',
    );
  });

  it('blocks a Round after an elimination stage', async () => {
    const previous = {
      ...completedRoundRobin(),
      format: RoundFormat.PLAYOFF,
      settings: { thirdPlaceMatch: false },
    };
    const { service, tx } = harness({ previous });

    await expectConflictCode(
      service.assertCanGenerate(tx as never, target),
      'ELIMINATION_MUST_BE_TERMINAL',
    );
  });

  it('blocks generation until the previous Round is structurally complete', async () => {
    const previous = completedRoundRobin();
    previous.matches[0].status = MatchStatus.PENDING;
    previous.matches[0].winnerTeamId = null;
    const { service, tx } = harness({ previous });

    await expectConflictCode(
      service.assertCanGenerate(tx as never, target),
      'PREVIOUS_ROUND_NOT_COMPLETE',
    );
  });

  it('allows generation after the preceding scoring Round is complete', async () => {
    const { service, tx } = harness();

    await expect(
      service.assertCanGenerate(tx as never, target),
    ).resolves.toBeUndefined();
    expect(tx.$queryRaw).toHaveBeenCalledTimes(3);
  });
});
