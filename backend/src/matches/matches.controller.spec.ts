import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { TournamentStaffRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ALLOW_ADMIN_OVERRIDE_KEY } from '../common/decorators/allow-admin-override.decorator';
import { OWNERSHIP_PARAM_KEY } from '../common/decorators/ownership.decorator';
import { TOURNAMENT_STAFF_ROLES_KEY } from '../common/decorators/tournament-staff-roles.decorator';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { PrismaService } from '../prisma/prisma.service';
import { MatchesController } from './matches.controller';

describe('tournament result review route', () => {
  it('requires an authenticated tournament manager or allowed staff member', () => {
    const handler = Object.getOwnPropertyDescriptor(
      MatchesController.prototype,
      'findTournamentResultReviews',
    )?.value as (tournamentId: string) => unknown;
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
      'tournaments/:tournamentId/result-reviews',
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      JwtAuthGuard,
      EmailVerifiedGuard,
      OwnershipGuard,
    ]);
    expect(Reflect.getMetadata(OWNERSHIP_PARAM_KEY, handler)).toBe(
      'tournamentId',
    );
    expect(Reflect.getMetadata(TOURNAMENT_STAFF_ROLES_KEY, handler)).toEqual([
      TournamentStaffRole.CO_ORGANIZER,
      TournamentStaffRole.REFEREE,
      TournamentStaffRole.SCOREKEEPER,
    ]);
    expect(Reflect.getMetadata(ALLOW_ADMIN_OVERRIDE_KEY, handler)).toBe(true);
  });

  it('allows the owner and listed staff roles, but rejects team members', async () => {
    const staffRoles = new Map([
      ['co-organizer', TournamentStaffRole.CO_ORGANIZER],
      ['referee', TournamentStaffRole.REFEREE],
      ['scorekeeper', TournamentStaffRole.SCOREKEEPER],
    ]);
    const prisma = {
      tournament: {
        findUnique: jest.fn().mockResolvedValue({ organizerId: 'owner' }),
      },
      tournamentStaff: {
        findUnique: jest
          .fn()
          .mockImplementation(
            ({
              where,
            }: {
              where: { tournamentId_userId: { userId: string } };
            }) => {
              const role = staffRoles.get(where.tournamentId_userId.userId);
              return role ? { role } : null;
            },
          ),
      },
    } as unknown as PrismaService;
    const guard = new OwnershipGuard(new Reflector(), prisma);
    const handler = Object.getOwnPropertyDescriptor(
      MatchesController.prototype,
      'findTournamentResultReviews',
    )?.value as () => unknown;
    const contextFor = (userId: string) =>
      ({
        getHandler: () => handler,
        getClass: () => MatchesController,
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id: userId },
            params: { tournamentId: 'tournament-1' },
            query: {},
          }),
        }),
      }) as unknown as ExecutionContext;

    for (const userId of ['owner', 'co-organizer', 'referee', 'scorekeeper']) {
      await expect(guard.canActivate(contextFor(userId))).resolves.toBe(true);
    }
    for (const userId of ['captain', 'member']) {
      await expect(
        guard.canActivate(contextFor(userId)),
      ).rejects.toBeInstanceOf(ForbiddenException);
    }
  });
});
