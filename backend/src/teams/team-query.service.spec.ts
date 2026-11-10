/* eslint-disable @typescript-eslint/unbound-method */
import { RegistrationStatus, Role, TournamentStaffRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TeamQueryService } from './team-query.service';

function harness() {
  const prisma = {
    tournament: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 't-1', organizerId: 'owner' }),
    },
    tournamentStaff: { findUnique: jest.fn().mockResolvedValue(null) },
    team: {
      findMany: jest.fn().mockResolvedValue([]),
      findUnique: jest.fn(),
    },
    match: { findMany: jest.fn().mockResolvedValue([]) },
  } as unknown as PrismaService;
  return { prisma, service: new TeamQueryService(prisma) };
}

describe('TeamQueryService access', () => {
  it('returns only approved teams and excludes private contact fields for guests', async () => {
    const { prisma, service } = harness();
    jest.mocked(prisma.team.findMany).mockResolvedValue([
      {
        id: 'team-1',
        name: 'Blue',
        members: [],
      },
    ] as never);

    const result = await service.findByTournament('cup', undefined, 'ALL');

    const query = jest.mocked(prisma.team.findMany).mock.calls[0][0];
    if (!query) throw new Error('Expected team list query');
    expect(query.where).toEqual({
      tournamentId: 't-1',
      status: RegistrationStatus.APPROVED,
    });
    expect(query.select).not.toHaveProperty('contactEmail');
    expect(query.select).not.toHaveProperty('contactPhone');
    expect(result[0]).toMatchObject({
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      rejectReason: null,
    });
  });

  it('lets co-organizers list pending teams and view registration details', async () => {
    const { prisma, service } = harness();
    jest.mocked(prisma.tournamentStaff.findUnique).mockResolvedValue({
      role: TournamentStaffRole.CO_ORGANIZER,
    } as never);
    jest.mocked(prisma.team.findMany).mockResolvedValue([
      {
        id: 'team-1',
        status: RegistrationStatus.PENDING,
        contactEmail: 'captain@example.com',
      },
    ] as never);
    jest.mocked(prisma.team.findUnique).mockResolvedValue({
      id: 'team-1',
      captainId: 'captain',
      contactEmail: 'captain@example.com',
      finalRank: null,
      tournament: { id: 't-1', organizerId: 'owner' },
      members: [],
    } as never);

    const teams = await service.findByTournament(
      'cup',
      'co-organizer',
      'ALL',
      Role.SIGNED_UP_USER,
    );
    const detail = await service.findOne(
      'team-1',
      'co-organizer',
      Role.SIGNED_UP_USER,
    );

    const query = jest.mocked(prisma.team.findMany).mock.calls[0][0];
    if (!query) throw new Error('Expected team list query');
    expect(query.where).toEqual({ tournamentId: 't-1' });
    expect(query.include).toBeDefined();
    expect(teams[0].contactEmail).toBe('captain@example.com');
    expect(detail.canViewSensitiveInfo).toBe(true);
    expect(detail.contactEmail).toBe('captain@example.com');
  });
});
