import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { TeamAccessGuard } from './team-access.guard';

function context(userId?: string) {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({
      getRequest: () => ({
        user: userId ? { id: userId } : undefined,
        params: { id: 'team-1' },
      }),
    }),
  } as unknown as ExecutionContext;
}

function guard() {
  const prisma = {
    team: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'team-1',
        captainId: 'captain-1',
        status: 'PENDING',
        tournamentId: 'tournament-1',
        tournament: {
          organizerId: 'organizer-1',
          status: 'REGISTRATION',
        },
      }),
    },
  } as unknown as PrismaService;
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue('CAPTAIN_OR_ORGANIZER'),
  } as unknown as Reflector;
  return new TeamAccessGuard(reflector, prisma);
}

describe('TeamAccessGuard roster authorization', () => {
  it.each(['captain-1', 'organizer-1'])(
    'allows authorized actor %s',
    async (userId) => {
      await expect(guard().canActivate(context(userId))).resolves.toBe(true);
    },
  );

  it('denies an unrelated authenticated user', async () => {
    await expect(
      guard().canActivate(context('unrelated-user')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('denies an anonymous caller', async () => {
    await expect(guard().canActivate(context())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
