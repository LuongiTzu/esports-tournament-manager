/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException, ForbiddenException } from '@nestjs/common';
import {
  NotificationType,
  TournamentAdminOverrideStatus,
} from '@prisma/client';
import { NotificationPublisher } from '../common/ports/notification-publisher';
import { TournamentManagementAccessService } from '../common/services/tournament-management-access.service';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentAdminOverrideService } from './tournament-admin-override.service';

function setup() {
  const prisma = {
    tournament: { findUnique: jest.fn() },
    tournamentAdminOverride: {
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const access = {
    findActiveOverride: jest.fn(),
  };
  const notifications = { createNotification: jest.fn() };
  return {
    service: new TournamentAdminOverrideService(
      prisma as unknown as PrismaService,
      access as unknown as TournamentManagementAccessService,
      notifications as unknown as NotificationPublisher,
    ),
    prisma,
    access,
    notifications,
  };
}

describe('TournamentAdminOverrideService', () => {
  it('starts a four-hour override and warns the Organizer', async () => {
    const { service, prisma, access, notifications } = setup();
    prisma.tournament.findUnique.mockResolvedValue({
      id: 't-1',
      organizerId: 'organizer-1',
    });
    access.findActiveOverride.mockResolvedValue(null);
    prisma.tournamentAdminOverride.create.mockImplementation(
      ({ data }: { data: Record<string, unknown> }) =>
        Promise.resolve({
          id: 'override-1',
          status: TournamentAdminOverrideStatus.ACTIVE,
          ...data,
        }),
    );

    await service.start(
      't-1',
      { id: 'admin-1', email: 'admin@example.com' },
      'Organizer requested emergency score support',
    );

    expect(prisma.tournamentAdminOverride.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tournamentId: 't-1',
          adminId: 'admin-1',
          expiresAt: expect.any(Date),
        }),
      }),
    );
    expect(notifications.createNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'organizer-1',
        type: NotificationType.ADMIN_WARNING,
        data: expect.objectContaining({
          kind: 'TOURNAMENT_ADMIN_OVERRIDE',
          overrideStatus: TournamentAdminOverrideStatus.ACTIVE,
          adminEmail: 'admin@example.com',
        }),
      }),
    );
  });

  it('does not create an override for the Tournament owner', async () => {
    const { service, prisma } = setup();
    prisma.tournament.findUnique.mockResolvedValue({
      id: 't-1',
      organizerId: 'admin-1',
    });

    await expect(
      service.start(
        't-1',
        { id: 'admin-1', email: 'admin@example.com' },
        'This reason is long enough',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('only lets the initiating Admin end an active override', async () => {
    const { service, prisma, access } = setup();
    prisma.tournament.findUnique.mockResolvedValue({
      id: 't-1',
      organizerId: 'organizer-1',
    });
    access.findActiveOverride.mockResolvedValue({
      id: 'override-1',
      adminId: 'admin-1',
    });

    await expect(
      service.end('t-1', {
        id: 'admin-2',
        email: 'admin-2@example.com',
      }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
