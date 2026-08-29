/* eslint-disable @typescript-eslint/unbound-method */
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OptionalJwtAuthGuard } from '../auth/guards/optional-jwt-auth.guard';
import { OWNERSHIP_PARAM_KEY } from '../common/decorators/ownership.decorator';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import { VisibilityGuard } from '../common/guards/visibility.guard';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentsController } from './tournaments.controller';

function ownershipGuard() {
  const prisma = {
    tournament: {
      findUnique: jest.fn().mockResolvedValue({ organizerId: 'organizer-1' }),
    },
  } as unknown as PrismaService;
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue('tournamentId'),
  } as unknown as Reflector;
  return new OwnershipGuard(reflector, prisma);
}

function context(userId?: string) {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({
      getRequest: () => ({
        user: userId ? { id: userId } : undefined,
        params: { tournamentId: 'tournament-1' },
        query: {},
      }),
    }),
  } as unknown as ExecutionContext;
}

describe('TournamentsController deletion authorization', () => {
  it('requires authentication and tournament ownership', () => {
    const method = TournamentsController.prototype.remove;

    expect(Reflect.getMetadata(GUARDS_METADATA, method)).toEqual([
      JwtAuthGuard,
      EmailVerifiedGuard,
      OwnershipGuard,
    ]);
    expect(Reflect.getMetadata(OWNERSHIP_PARAM_KEY, method)).toBe(
      'tournamentId',
    );
  });

  it('allows the organizer', async () => {
    await expect(
      ownershipGuard().canActivate(context('organizer-1')),
    ).resolves.toBe(true);
  });

  it.each([['unrelated-user'], [undefined]])(
    'denies a non-owner or anonymous caller',
    async (userId) => {
      await expect(
        ownershipGuard().canActivate(context(userId)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    },
  );
});

describe('TournamentsController favorite authorization', () => {
  it.each([
    TournamentsController.prototype.favorite,
    TournamentsController.prototype.unfavorite,
  ])(
    'requires authentication and canonical Tournament visibility',
    (method) => {
      expect(Reflect.getMetadata(GUARDS_METADATA, method)).toEqual([
        JwtAuthGuard,
        VisibilityGuard,
      ]);
    },
  );

  it('keeps the public list optionally authenticated', () => {
    expect(
      Reflect.getMetadata(
        GUARDS_METADATA,
        TournamentsController.prototype.findAll,
      ),
    ).toEqual([OptionalJwtAuthGuard]);
  });
});
