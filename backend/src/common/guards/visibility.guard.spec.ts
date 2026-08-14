import { ExecutionContext, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModerationStatus, Role, Visibility } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { VisibilityGuard } from './visibility.guard';

type User = { id: string; role: Role };
type Resource = 'slug:slug' | 'team:id';
type TournamentVisibility = {
  id: string;
  organizerId: string;
  visibility: Visibility;
  moderationStatus: ModerationStatus;
};

const activeTournament: TournamentVisibility = {
  id: 't-1',
  organizerId: 'organizer',
  visibility: Visibility.PUBLIC,
  moderationStatus: ModerationStatus.ACTIVE,
};

function context(user?: User) {
  return {
    getHandler: () => null,
    getClass: () => null,
    switchToHttp: () => ({
      getRequest: () => ({ params: { slug: 'cup', id: 'team-1' }, user }),
    }),
  } as unknown as ExecutionContext;
}

function harness(
  resource: Resource,
  tournament: TournamentVisibility | null,
  belongsToTeam = false,
) {
  const findMembership = jest
    .fn()
    .mockResolvedValue(belongsToTeam ? { id: 'team-1' } : null);
  const findTeamById = jest
    .fn()
    .mockResolvedValue(tournament ? { tournament } : null);
  const findTournamentBySlug = jest.fn().mockResolvedValue(tournament);
  const prisma = {
    tournament: { findUnique: findTournamentBySlug },
    team: { findUnique: findTeamById, findFirst: findMembership },
  } as unknown as PrismaService;
  const reflector = {
    getAllAndOverride: jest.fn().mockReturnValue(resource),
  } as unknown as Reflector;

  return {
    guard: new VisibilityGuard(reflector, prisma),
    findMembership,
    findTeamById,
    findTournamentBySlug,
  };
}

const resources: Array<[string, Resource]> = [
  ['tournament team list', 'slug:slug'],
  ['direct team detail', 'team:id'],
];

describe.each(resources)('VisibilityGuard - %s', (_label, resource) => {
  it.each([
    ['anonymous', undefined],
    ['unrelated user', { id: 'unrelated', role: Role.SIGNED_UP_USER }],
    ['captain', { id: 'captain', role: Role.SIGNED_UP_USER }],
    ['member', { id: 'member', role: Role.SIGNED_UP_USER }],
    ['organizer', { id: 'organizer', role: Role.SIGNED_UP_USER }],
    ['admin', { id: 'admin', role: Role.ADMIN }],
  ] as Array<[string, User | undefined]>)(
    'allows %s for a public active tournament',
    async (_actor, user) => {
      await expect(
        harness(resource, activeTournament).guard.canActivate(context(user)),
      ).resolves.toBe(true);
    },
  );

  it.each([
    ['anonymous', undefined, false],
    ['unrelated user', { id: 'unrelated', role: Role.SIGNED_UP_USER }, false],
  ] as Array<[string, User | undefined, boolean]>)(
    'denies %s for a private tournament',
    async (_actor, user, belongsToTeam) => {
      const { guard } = harness(
        resource,
        {
          ...activeTournament,
          visibility: Visibility.PRIVATE,
        },
        belongsToTeam,
      );
      await expect(guard.canActivate(context(user))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    },
  );

  it.each([
    ['captain', { id: 'captain', role: Role.SIGNED_UP_USER }, true],
    ['member', { id: 'member', role: Role.SIGNED_UP_USER }, true],
    ['organizer', { id: 'organizer', role: Role.SIGNED_UP_USER }, false],
    ['admin', { id: 'admin', role: Role.ADMIN }, false],
  ] as Array<[string, User, boolean]>)(
    'allows %s for a private tournament',
    async (_actor, user, belongsToTeam) => {
      const { guard } = harness(
        resource,
        {
          ...activeTournament,
          visibility: Visibility.PRIVATE,
        },
        belongsToTeam,
      );
      await expect(guard.canActivate(context(user))).resolves.toBe(true);
    },
  );

  it.each([
    ['anonymous', undefined],
    ['unrelated user', { id: 'unrelated', role: Role.SIGNED_UP_USER }],
    ['captain', { id: 'captain', role: Role.SIGNED_UP_USER }],
    ['member', { id: 'member', role: Role.SIGNED_UP_USER }],
  ] as Array<[string, User | undefined]>)(
    'denies %s for a tournament hidden by admin',
    async (_actor, user) => {
      const { guard } = harness(
        resource,
        {
          ...activeTournament,
          moderationStatus: ModerationStatus.HIDDEN_BY_ADMIN,
        },
        true,
      );
      await expect(guard.canActivate(context(user))).rejects.toBeInstanceOf(
        NotFoundException,
      );
    },
  );

  it.each([
    ['organizer', { id: 'organizer', role: Role.SIGNED_UP_USER }],
    ['admin', { id: 'admin', role: Role.ADMIN }],
  ] as Array<[string, User]>)(
    'allows %s for a tournament hidden by admin',
    async (_actor, user) => {
      const { guard } = harness(resource, {
        ...activeTournament,
        moderationStatus: ModerationStatus.HIDDEN_BY_ADMIN,
      });
      await expect(guard.canActivate(context(user))).resolves.toBe(true);
    },
  );

  it('does not expose whether the parent resource is missing', async () => {
    await expect(
      harness(resource, null).guard.canActivate(context()),
    ).rejects.toMatchObject({
      response: {
        statusCode: 404,
        message: 'Không tìm thấy giải đấu',
      },
    });
  });
});

describe('VisibilityGuard resource resolution', () => {
  it('resolves the parent tournament using the requested team id', async () => {
    const { guard, findTeamById, findTournamentBySlug } = harness(
      'team:id',
      activeTournament,
    );

    await guard.canActivate(context());

    expect(findTeamById).toHaveBeenCalledWith({
      where: { id: 'team-1' },
      select: {
        tournament: {
          select: {
            id: true,
            organizerId: true,
            visibility: true,
            moderationStatus: true,
          },
        },
      },
    });
    expect(findTournamentBySlug).not.toHaveBeenCalled();
  });
});
