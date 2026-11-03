import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GUARDS_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import { TournamentStaffRole } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EmailVerifiedGuard } from '../common/guards/email-verified.guard';
import { OwnershipGuard } from '../common/guards/ownership.guard';
import { PrismaService } from '../prisma/prisma.service';
import { MatchesController } from './matches.controller';

const handler = Object.getOwnPropertyDescriptor(
  MatchesController.prototype,
  'updateYouTube',
)?.value as () => unknown;

describe('match YouTube access', () => {
  it('requires authentication, verified email and ownership guards', () => {
    expect(Reflect.getMetadata(PATH_METADATA, handler)).toBe(
      'matches/:id/youtube',
    );
    expect(Reflect.getMetadata(GUARDS_METADATA, handler)).toEqual([
      JwtAuthGuard,
      EmailVerifiedGuard,
      OwnershipGuard,
    ]);
  });

  it('allows the owner, assigned match staff and active admin override only', async () => {
    const roles: Record<string, TournamentStaffRole> = {
      co: 'CO_ORGANIZER',
      referee: 'REFEREE',
      scorer: 'SCOREKEEPER',
    };
    const prisma = {
      match: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ round: { tournamentId: 't1' } }),
      },
      tournament: {
        findUnique: jest.fn().mockResolvedValue({ organizerId: 'owner' }),
      },
      tournamentStaff: {
        findUnique: jest.fn().mockImplementation(
          ({
            where,
          }: {
            where: {
              tournamentId_userId: { tournamentId: string; userId: string };
            };
          }) => {
            const membership = where.tournamentId_userId;
            return membership.tournamentId === 't1' && roles[membership.userId]
              ? { role: roles[membership.userId] }
              : null;
          },
        ),
      },
      tournamentAdminOverride: {
        findFirst: jest
          .fn()
          .mockImplementation(({ where }: { where: { adminId: string } }) =>
            where.adminId === 'active-admin'
              ? {
                  id: 'override',
                  tournamentId: 't1',
                  adminId: 'active-admin',
                  reason: 'Support',
                }
              : null,
          ),
      },
    } as unknown as PrismaService;
    const guard = new OwnershipGuard(new Reflector(), prisma);
    const contextFor = (id: string, role = 'SIGNED_UP_USER') =>
      ({
        getHandler: () => handler,
        getClass: () => MatchesController,
        switchToHttp: () => ({
          getRequest: () => ({
            user: { id, role },
            params: { id: 'm1' },
            query: {},
          }),
        }),
      }) as unknown as ExecutionContext;
    for (const id of ['owner', 'co', 'referee', 'scorer']) {
      await expect(guard.canActivate(contextFor(id))).resolves.toBe(true);
    }
    await expect(
      guard.canActivate(contextFor('active-admin', 'ADMIN')),
    ).resolves.toBe(true);
    for (const id of ['captain', 'member', 'other-tournament-staff']) {
      await expect(guard.canActivate(contextFor(id))).rejects.toBeInstanceOf(
        ForbiddenException,
      );
    }
    await expect(
      guard.canActivate(contextFor('inactive-admin', 'ADMIN')),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
