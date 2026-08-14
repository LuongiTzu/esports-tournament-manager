import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Role } from '@prisma/client';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { OwnershipGuard } from './ownership.guard';

describe('OwnershipGuard round ownership', () => {
  it.each([
    ['unrelated signed-up user', Role.SIGNED_UP_USER],
    ['non-organizer admin', Role.ADMIN],
  ])('rejects a %s', async (_actor, role) => {
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
          user: { id: 'other-user', role },
          params: { id: 'round-1' },
          query: {},
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows the tournament organizer for a round resource', async () => {
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
          user: { id: 'organizer', role: Role.SIGNED_UP_USER },
          params: { id: 'round-1' },
          query: {},
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
  });

  it('authorizes bulk matches only through their common tournament organizer', async () => {
    const findTournament = jest
      .fn()
      .mockResolvedValue({ organizerId: 'organizer' });
    const prisma = {
      match: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'm-1', round: { tournamentId: 't-1' } },
          { id: 'm-2', round: { tournamentId: 't-1' } },
        ]),
      },
      tournament: {
        findUnique: findTournament,
      },
    } as unknown as PrismaService;
    const reflector = {
      getAllAndOverride: jest.fn().mockReturnValue('matches:body'),
    } as unknown as Reflector;
    const guard = new OwnershipGuard(reflector, prisma);
    const context = {
      getHandler: () => null,
      getClass: () => null,
      switchToHttp: () => ({
        getRequest: () => ({
          user: { id: 'organizer' },
          params: {},
          query: {},
          body: { matches: [{ matchId: 'm-1' }, { matchId: 'm-2' }] },
        }),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(findTournament).toHaveBeenCalledWith({
      where: { id: 't-1' },
      select: { organizerId: true },
    });
  });
});
