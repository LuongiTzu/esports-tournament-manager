import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModerationStatus, Role, Visibility } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VisibilityGuard } from './visibility.guard';

function context(user?: { id: string; role: Role }) {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({
      getRequest: () => ({ params: { slug: 'cup' }, user }),
    }),
  } as unknown as ExecutionContext;
}

function harness(
  tournament: {
    id: string;
    organizerId: string;
    visibility: Visibility;
    moderationStatus: ModerationStatus;
  },
  team: { id: string } | null = null,
) {
  const findTeam = jest.fn().mockResolvedValue(team);
  const prisma = {
    tournament: { findUnique: jest.fn().mockResolvedValue(tournament) },
    team: { findFirst: findTeam },
  } as unknown as PrismaService;
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue('slug:slug'),
  } as unknown as Reflector;
  return { guard: new VisibilityGuard(reflector, prisma), findTeam };
}

const activeTournament = {
  id: 't-1',
  organizerId: 'organizer',
  visibility: Visibility.PUBLIC,
  moderationStatus: ModerationStatus.ACTIVE,
};

describe('VisibilityGuard', () => {
  it('allows an anonymous visitor to view a public active tournament', async () => {
    const { guard } = harness(activeTournament);
    await expect(guard.canActivate(context())).resolves.toBe(true);
  });

  it('rejects an anonymous visitor for a private tournament', async () => {
    const { guard } = harness({
      ...activeTournament,
      visibility: Visibility.PRIVATE,
    });
    await expect(guard.canActivate(context())).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it.each([
    ['organizer', Role.SIGNED_UP_USER],
    ['admin', Role.ADMIN],
  ] as const)('allows %s to view a private tournament', async (id, role) => {
    const { guard } = harness({
      ...activeTournament,
      visibility: Visibility.PRIVATE,
    });
    await expect(guard.canActivate(context({ id, role }))).resolves.toBe(true);
  });

  it.each(['captain', 'member'])(
    'allows a private tournament %s',
    async (id) => {
      const { guard, findTeam } = harness(
        { ...activeTournament, visibility: Visibility.PRIVATE },
        { id: 'team-1' },
      );
      await expect(
        guard.canActivate(context({ id, role: Role.SIGNED_UP_USER })),
      ).resolves.toBe(true);
      expect(findTeam).toHaveBeenCalledWith({
        where: {
          tournamentId: 't-1',
          OR: [{ captainId: id }, { members: { some: { userId: id } } }],
        },
        select: { id: true },
      });
    },
  );

  it('rejects an unrelated user for a private tournament', async () => {
    const { guard } = harness({
      ...activeTournament,
      visibility: Visibility.PRIVATE,
    });
    await expect(
      guard.canActivate(
        context({ id: 'unrelated', role: Role.SIGNED_UP_USER }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('allows only organizer or admin when hidden by admin', async () => {
    const hidden = {
      ...activeTournament,
      visibility: Visibility.PRIVATE,
      moderationStatus: ModerationStatus.HIDDEN_BY_ADMIN,
    };
    await expect(
      harness(hidden).guard.canActivate(
        context({ id: 'member', role: Role.SIGNED_UP_USER }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
    await expect(
      harness(hidden).guard.canActivate(
        context({ id: 'admin', role: Role.ADMIN }),
      ),
    ).resolves.toBe(true);
    await expect(
      harness(hidden).guard.canActivate(
        context({ id: 'organizer', role: Role.SIGNED_UP_USER }),
      ),
    ).resolves.toBe(true);
  });
});
