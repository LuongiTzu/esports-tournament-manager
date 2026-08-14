import { BadRequestException } from '@nestjs/common';
import { RegistrationStatus, TournamentStatus } from '@prisma/client';
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
  } as unknown as PrismaService;
  const validator = {
    buildRules: jest.fn(),
    validate: jest.fn(),
  } as unknown as RegistrationValidatorService;
  const contentFilter = {
    validate: jest.fn(),
  } as unknown as ContentFilterService;
  return {
    service: new TeamsService(
      prisma,
      validator,
      {} as NotificationService,
      contentFilter,
    ),
    teamClient,
    teamMemberClient,
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
