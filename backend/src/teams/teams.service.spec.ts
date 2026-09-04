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
import { TournamentEventsService } from '../tournaments/tournament-events.service';
import { ActivityEmailPublisher } from '../common/ports/activity-email-publisher';

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
    members: [],
    tournament,
  };
}

function harness(teamValue = team()) {
  const teamClient = {
    findUnique: jest.fn().mockResolvedValue(teamValue),
    findFirst: jest.fn().mockResolvedValue(null),
    update: jest.fn().mockResolvedValue({ id: 'team-1' }),
    delete: jest.fn().mockResolvedValue({ id: 'team-1' }),
  };
  const roundClient = {
    findFirst: jest.fn().mockResolvedValue(null),
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
      (
        callback: (client: {
          team: typeof teamClient;
          round: typeof roundClient;
          $queryRaw: jest.Mock;
        }) => unknown,
      ) =>
        callback({
          team: teamClient,
          round: roundClient,
          $queryRaw: jest.fn(),
        }),
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
    createForUsers: jest.fn().mockResolvedValue([{ id: 'notification-1' }]),
    emitCreated: jest.fn(),
  } as unknown as NotificationService;
  const events = { publish: jest.fn() } as unknown as TournamentEventsService;
  const activityEmails = {
    publish: jest.fn().mockResolvedValue(undefined),
  } as unknown as ActivityEmailPublisher;
  return {
    service: new TeamsService(
      prisma,
      validator,
      notifications,
      contentFilter,
      events,
      activityEmails,
    ),
    teamClient,
    roundClient,
    teamMemberClient,
    notifications,
    validator,
    events,
    activityEmails,
  };
}

describe('TeamsService roster lifecycle', () => {
  it('publishes a registration-success email only after the team is created', async () => {
    const { service, activityEmails } = harness();
    Object.assign(service, {
      loadTournamentForRegistration: jest.fn().mockResolvedValue({
        id: 'tournament-1',
        autoApproveTeams: false,
      }),
      resolveBlockingReason: jest.fn().mockResolvedValue(null),
      createTeam: jest.fn().mockResolvedValue({
        id: 'team-1',
        name: 'Ruby Wolves',
        status: RegistrationStatus.PENDING,
      }),
    });

    await service.register('captain-1', 'arena-cup', {} as never);

    expect(activityEmails.publish).toHaveBeenCalledWith({
      kind: 'TEAM_REGISTRATION_SUCCEEDED',
      userId: 'captain-1',
      tournamentId: 'tournament-1',
      teamName: 'Ruby Wolves',
      status: RegistrationStatus.PENDING,
    });
  });

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

  it('revalidates the persisted roster with self-exclusion before approval', async () => {
    const { service, validator } = harness();

    await service.updateStatus('team-1', {
      status: RegistrationStatus.APPROVED,
    });

    expect(jest.mocked(validator.validate)).toHaveBeenCalledWith(
      undefined,
      [],
      expect.objectContaining({ excludeTeamId: 'team-1' }),
    );
  });

  it('blocks approval after the first Round participant set is frozen', async () => {
    const { service, roundClient, teamClient, validator } = harness();
    roundClient.findFirst.mockResolvedValueOnce({
      id: 'round-1',
      _count: { matches: 1, groups: 0 },
    });

    await expect(
      service.updateStatus('team-1', {
        status: RegistrationStatus.APPROVED,
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'TOURNAMENT_PARTICIPANTS_LOCKED',
      }),
    });
    expect(jest.mocked(validator.validate)).not.toHaveBeenCalled();
    expect(teamClient.update).not.toHaveBeenCalled();
  });

  it('still allows rejecting a pending team after participants are frozen', async () => {
    const { service, roundClient, teamClient } = harness();
    roundClient.findFirst.mockResolvedValueOnce({
      id: 'round-1',
      _count: { matches: 1, groups: 0 },
    });

    await expect(
      service.updateStatus('team-1', {
        status: RegistrationStatus.REJECTED,
        rejectReason: 'Registration was not accepted',
      }),
    ).resolves.toEqual({ id: 'team-1' });
    expect(roundClient.findFirst).not.toHaveBeenCalled();
    expect(teamClient.update).toHaveBeenCalled();
  });

  it('blocks removing an approved participant after the first Round is generated', async () => {
    const approvedTeam = team(
      RegistrationStatus.APPROVED,
      lifecycleTournament({ organizerId: 'organizer-1' }),
    );
    const { service, roundClient, teamClient } = harness(approvedTeam);
    roundClient.findFirst.mockResolvedValueOnce({
      id: 'round-1',
      _count: { matches: 1, groups: 0 },
    });

    await expect(service.remove('team-1', 'organizer-1')).rejects.toMatchObject(
      {
        response: expect.objectContaining({
          code: 'TOURNAMENT_PARTICIPANTS_LOCKED',
        }),
      },
    );
    expect(teamClient.delete).not.toHaveBeenCalled();
  });

  it('allows a pending team to withdraw after the approved participant set is frozen', async () => {
    const pendingTeam = team(
      RegistrationStatus.PENDING,
      lifecycleTournament({ organizerId: 'organizer-1' }),
    );
    const { service, roundClient, teamClient } = harness(pendingTeam);
    roundClient.findFirst.mockResolvedValueOnce({
      id: 'round-1',
      _count: { matches: 1, groups: 0 },
    });

    await expect(service.remove('team-1', 'captain-1')).resolves.toEqual({
      message: 'Đã xóa đội thành công',
    });
    expect(roundClient.findFirst).not.toHaveBeenCalled();
    expect(teamClient.delete).toHaveBeenCalledWith({
      where: { id: 'team-1' },
    });
  });

  it('rejects a second review without notifications or realtime', async () => {
    const { service, notifications, events } = harness(
      team(RegistrationStatus.APPROVED),
    );

    await expect(
      service.updateStatus('team-1', {
        status: RegistrationStatus.REJECTED,
        rejectReason: 'Changed mind',
      }),
    ).rejects.toMatchObject({
      response: expect.objectContaining({
        code: 'INVALID_REGISTRATION_STATUS_TRANSITION',
      }),
    });
    expect(jest.mocked(notifications.createForUsers)).not.toHaveBeenCalled();
    expect(jest.mocked(events.publish)).not.toHaveBeenCalled();
  });

  it('does not persist review side effects when roster revalidation fails', async () => {
    const { service, validator, teamClient, notifications, events } = harness();
    jest
      .mocked(validator.validate)
      .mockRejectedValueOnce(new BadRequestException('invalid roster'));

    await expect(
      service.updateStatus('team-1', {
        status: RegistrationStatus.APPROVED,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(teamClient.update).not.toHaveBeenCalled();
    expect(jest.mocked(notifications.createForUsers)).not.toHaveBeenCalled();
    expect(jest.mocked(events.publish)).not.toHaveBeenCalled();
  });

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
    'notifies the linked users when registration is %s',
    async (status, rejectReason, type) => {
      const { service, notifications } = harness();

      await service.updateStatus('team-1', { status, rejectReason });

      expect(jest.mocked(notifications.createForUsers)).toHaveBeenCalledWith(
        expect.objectContaining({
          userIds: ['captain-1'],
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

  it('targets the captain and every linked member on rejection', async () => {
    const reviewedTeam = {
      ...team(),
      members: [
        { userId: 'captain-1' },
        { userId: 'member-1' },
        { userId: null },
      ],
    } as never;
    const { service, notifications } = harness(reviewedTeam);

    await service.updateStatus('team-1', {
      status: RegistrationStatus.REJECTED,
      rejectReason: 'Roster is incomplete',
    });

    expect(notifications.createForUsers).toHaveBeenCalledWith(
      expect.objectContaining({
        userIds: ['captain-1', 'captain-1', 'member-1', null],
        data: expect.objectContaining({
          kind: 'TEAM_REVIEW',
          teamName: 'Team One',
          rejectReason: 'Roster is incomplete',
        }),
      }),
      expect.anything(),
      false,
    );
  });

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
      { publish: jest.fn() },
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
