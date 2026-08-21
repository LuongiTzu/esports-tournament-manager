/* eslint-disable @typescript-eslint/unbound-method, @typescript-eslint/no-unsafe-assignment */
import { BadRequestException } from '@nestjs/common';
import {
  NotificationType,
  RegistrationStatus,
  TournamentStatus,
} from '@prisma/client';
import { ContentFilterService } from '../common/services/content-filter.service';
import { NotificationService } from '../notifications/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { RegistrationValidatorService } from './registration-validator.service';
import { TeamsService } from './teams.service';

function lifecycleTournament(overrides: Record<string, unknown> = {}) {
  return {
    status: TournamentStatus.REGISTRATION,
    registrationOpen: true,
    registrationStartDate: new Date('2000-01-01T00:00:00.000Z'),
    registrationDeadline: new Date('2099-01-01T00:00:00.000Z'),
    startDate: new Date('2099-02-01T00:00:00.000Z'),
    maxTeams: null,
    ...overrides,
  };
}

function team(
  status: RegistrationStatus = RegistrationStatus.PENDING,
  tournament = lifecycleTournament(),
) {
  return {
    id: 'team-1',
    name: 'Team One',
    status,
    captainId: 'captain-1',
    tournamentId: 'tournament-1',
    tournament,
  };
}

function harness(teamValue = team()) {
  const teamClient = {
    findUnique: jest.fn().mockResolvedValue(teamValue),
    findFirst: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ id: 'team-1' }),
  };
  const teamMemberClient = {
    findMany: jest.fn().mockResolvedValue([]),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const prisma = {
    team: teamClient,
    teamMember: teamMemberClient,
    tournament: { findUniqueOrThrow: jest.fn() },
    $transaction: jest.fn(
      (callback: (client: { team: typeof teamClient }) => unknown) =>
        callback({ team: teamClient }),
    ),
  } as unknown as PrismaService;
  const validator = {
    buildRules: jest.fn(),
    validate: jest.fn(),
  } as unknown as RegistrationValidatorService;
  const contentFilter = {
    validate: jest.fn(),
  } as unknown as ContentFilterService;
  const notifications = {
    createNotification: jest.fn().mockResolvedValue({ id: 'notification-1' }),
    emitCreated: jest.fn(),
  } as unknown as NotificationService;
  return {
    service: new TeamsService(prisma, validator, notifications, contentFilter),
    teamClient,
    teamMemberClient,
    notifications,
  };
}

describe('TeamsService roster lifecycle', () => {
  it.each([
    RegistrationStatus.PENDING,
    RegistrationStatus.APPROVED,
    RegistrationStatus.REJECTED,
  ])(
    'allows %s team profile edits while registration is open',
    async (status) => {
      const { service, teamClient } = harness(team(status));

      await expect(
        service.update('team-1', { shortName: 'ONE' }),
      ).resolves.toEqual({ id: 'team-1' });
      expect(teamClient.update).toHaveBeenCalled();
    },
  );

  it.each([
    ['registration toggle is closed', { registrationOpen: false }],
    [
      'registration deadline has passed',
      { registrationDeadline: new Date('2000-01-02T00:00:00.000Z') },
    ],
    ['tournament is ongoing', { status: TournamentStatus.ONGOING }],
    [
      'tournament start date has passed',
      { startDate: new Date('2000-01-02T00:00:00.000Z') },
    ],
  ])('blocks team edits when %s', async (_, lifecycle) => {
    const { service, teamClient } = harness(
      team(RegistrationStatus.PENDING, lifecycleTournament(lifecycle)),
    );

    await expect(
      service.update('team-1', { shortName: 'LOCKED' }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(teamClient.update).not.toHaveBeenCalled();
  });

  it.each([
    [RegistrationStatus.APPROVED, undefined, NotificationType.TEAM_APPROVED],
    [
      RegistrationStatus.REJECTED,
      'Roster invalid',
      NotificationType.TEAM_REJECTED,
    ],
  ] as const)(
    'preserves the %s captain notification',
    async (status, rejectReason, type) => {
      const { service, notifications } = harness();

      await service.updateStatus('team-1', { status, rejectReason });

      expect(
        jest.mocked(notifications.createNotification),
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'captain-1',
          tournamentId: 'tournament-1',
          type,
        }),
        expect.anything(),
        false,
      );
      expect(jest.mocked(notifications.emitCreated)).toHaveBeenCalledWith({
        id: 'notification-1',
      });
    },
  );

  it.each([
    [
      'addMember',
      (service: TeamsService) => service.addMember('team-1', {} as never),
    ],
    [
      'updateMember',
      (service: TeamsService) => service.updateMember('team-1', 'member-1', {}),
    ],
    [
      'removeMember',
      (service: TeamsService) => service.removeMember('team-1', 'member-1'),
    ],
  ] as const)('blocks %s after registration locks', async (_, mutate) => {
    const { service, teamMemberClient } = harness(
      team(
        RegistrationStatus.PENDING,
        lifecycleTournament({ registrationOpen: false }),
      ),
    );

    await expect(mutate(service)).rejects.toBeInstanceOf(BadRequestException);
    expect(teamMemberClient.create).not.toHaveBeenCalled();
    expect(teamMemberClient.update).not.toHaveBeenCalled();
    expect(teamMemberClient.delete).not.toHaveBeenCalled();
  });
});

describe('TeamsService public history', () => {
  it('derives completed match history from the visible team tournament data', async () => {
    const prisma = {
      team: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'team-1',
          name: 'Team One',
          captainId: 'captain-1',
          finalRank: 2,
          contactEmail: 'private@example.com',
          contactPhone: '0900000000',
          rejectReason: null,
          tournament: {
            id: 'tournament-1',
            slug: 'cup',
            name: 'Cup',
            status: TournamentStatus.COMPLETED,
            organizerId: 'organizer-1',
          },
          members: [],
        }),
      },
      match: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'm-win',
            winnerTeamId: 'team-1',
            outcome: 'TEAM_A',
            scoreA: 2,
            scoreB: 0,
          },
          {
            id: 'm-draw',
            winnerTeamId: null,
            outcome: 'DRAW',
            scoreA: 1,
            scoreB: 1,
          },
          {
            id: 'm-loss',
            winnerTeamId: 'team-2',
            outcome: 'TEAM_B',
            scoreA: 0,
            scoreB: 2,
          },
        ]),
      },
    } as unknown as PrismaService;
    const service = new TeamsService(
      prisma,
      {} as RegistrationValidatorService,
      {} as NotificationService,
      {} as ContentFilterService,
    );

    const result = await service.findOne('team-1');

    expect(result.history).toEqual(
      expect.objectContaining({
        completedMatches: 3,
        wins: 1,
        draws: 1,
        losses: 1,
        finalRank: 2,
      }),
    );
    expect(result.history.recentMatches).toHaveLength(3);
    expect(result.contactEmail).toBeNull();
    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'COMPLETED',
          OR: [{ teamAId: 'team-1' }, { teamBId: 'team-1' }],
        }),
      }),
    );
  });
});
