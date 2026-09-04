import { ConflictException } from '@nestjs/common';
import { RegistrationStatus } from '@prisma/client';
import { RoundParticipantResolver } from './round-participant-resolver.service';

describe('RoundParticipantResolver', () => {
  const resolver = new RoundParticipantResolver();
  const approvedTeam = {
    id: 'team-1',
    name: 'Team 1',
    seed: 1,
    registeredAt: new Date('2026-01-01T00:00:00.000Z'),
  };

  function client(input?: {
    approvedTeams?: (typeof approvedTeam)[];
    assignments?: Array<{
      seed?: number | null;
      team: typeof approvedTeam & {
        tournamentId: string;
        status: RegistrationStatus;
      };
    }>;
  }) {
    return {
      team: {
        findMany: jest.fn().mockResolvedValue(input?.approvedTeams ?? []),
      },
      roundTeam: {
        findMany: jest.fn().mockResolvedValue(input?.assignments ?? []),
      },
    };
  }

  it('uses approved Tournament teams only for the first Round', async () => {
    const tx = client({ approvedTeams: [approvedTeam] });

    await expect(
      resolver.resolveForGeneration(tx as never, {
        id: 'round-1',
        tournamentId: 'tournament-1',
        orderIndex: 1,
      }),
    ).resolves.toEqual({
      source: 'APPROVED_TEAMS',
      teams: [approvedTeam],
    });
    expect(tx.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tournamentId: 'tournament-1',
          status: RegistrationStatus.APPROVED,
        },
      }),
    );
    expect(tx.roundTeam.findMany).not.toHaveBeenCalled();
  });

  it('uses only persisted RoundTeam assignments for later Rounds', async () => {
    const tx = client({
      assignments: [
        {
          seed: 4,
          team: {
            ...approvedTeam,
            tournamentId: 'tournament-1',
            status: RegistrationStatus.APPROVED,
          },
        },
      ],
    });

    await expect(
      resolver.resolveForGeneration(tx as never, {
        id: 'round-2',
        tournamentId: 'tournament-1',
        orderIndex: 2,
      }),
    ).resolves.toEqual({
      source: 'ROUND_PARTICIPANTS',
      teams: [{ ...approvedTeam, seed: 4 }],
    });
    expect(tx.team.findMany).not.toHaveBeenCalled();
  });

  it('never falls back to all approved teams for a later Round', async () => {
    const tx = client({ approvedTeams: [approvedTeam] });

    const failure = await resolver
      .resolveForGeneration(tx as never, {
        id: 'round-2',
        tournamentId: 'tournament-1',
        orderIndex: 2,
      })
      .catch((error: unknown) => error);
    expect(failure).toBeInstanceOf(ConflictException);
    expect((failure as ConflictException).getResponse()).toEqual(
      expect.objectContaining({
        code: 'ROUND_PARTICIPANTS_NOT_READY',
      }),
    );
    expect(tx.team.findMany).not.toHaveBeenCalled();
  });

  it.each([
    ['another Tournament', 'tournament-2', RegistrationStatus.APPROVED],
    ['a non-approved status', 'tournament-1', RegistrationStatus.REJECTED],
  ])(
    'rejects a participant belonging to %s',
    async (_, tournamentId, status) => {
      const tx = client({
        assignments: [
          {
            team: {
              ...approvedTeam,
              tournamentId,
              status,
            },
          },
        ],
      });

      await expect(
        resolver.resolveForGeneration(tx as never, {
          id: 'round-2',
          tournamentId: 'tournament-1',
          orderIndex: 2,
        }),
      ).rejects.toBeInstanceOf(ConflictException);
    },
  );
});
