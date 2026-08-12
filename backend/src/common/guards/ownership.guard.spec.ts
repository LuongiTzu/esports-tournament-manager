import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { OwnershipGuard } from './ownership.guard';

describe('OwnershipGuard round ownership', () => {
  it('rejects a signed-in non-organizer', async () => {
    const prisma = {
      round: {
        findUnique: jest.fn().mockResolvedValue({ tournamentId: 't-1' }),
      },
      tournament: {
        findUnique: jest.fn().mockResolvedValue({ organizerId: 'organizer' }),
      },
    } as unknown as PrismaService;
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('round:id'),
    } as unknown as Reflector;
    const guard = new OwnershipGuard(reflector, prisma);
    const context = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'other-user' },
          params: { id: 'round-1' },
          query: {},
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
