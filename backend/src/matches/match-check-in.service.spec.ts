/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, ForbiddenException } from '@nestjs/common';
import { MatchStatus, RegistrationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MatchCheckInService } from './match-check-in.service';

const scheduledAt = new Date('2030-06-15T12:00:00.000Z');

function match(overrides: Record<string, unknown> = {}) {
  return {
    id: 'match-1',
    status: MatchStatus.PENDING,
    isActive: true,
    isBye: false,
    scheduledAt,
    teamA: {
      id: 'team-1',
      captainId: 'captain-1',
      status: RegistrationStatus.APPROVED,
    },
    teamB: {
      id: 'team-2',
      captainId: 'captain-2',
      status: RegistrationStatus.APPROVED,
    },
    checkIns: [],
    ...overrides,
  };
}

function harness() {
  const prisma = {
    match: { findUnique: jest.fn() },
    matchCheckIn: { upsert: jest.fn() },
  } as unknown as PrismaService;
  return { prisma, service: new MatchCheckInService(prisma) };
}

describe('MatchCheckInService', () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date('2030-06-15T11:45:00.000Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('checks an approved team in during the pre-match window', async () => {
    const { prisma, service } = harness();
    const checkIn = {
      id: 'check-in-1',
      matchId: 'match-1',
      teamId: 'team-1',
      checkedInAt: new Date(),
    };
    jest.mocked(prisma.match.findUnique).mockResolvedValue(match() as never);
    jest.mocked(prisma.matchCheckIn.upsert).mockResolvedValue(checkIn as never);

    await expect(
      service.checkIn('match-1', 'captain-1', { teamId: 'team-1' }),
    ).resolves.toEqual(checkIn);
    expect(prisma.matchCheckIn.upsert).toHaveBeenCalledWith({
      where: {
        matchId_teamId: { matchId: 'match-1', teamId: 'team-1' },
      },
      create: {
        matchId: 'match-1',
        teamId: 'team-1',
        checkedInById: 'captain-1',
      },
      update: {},
      select: {
        id: true,
        matchId: true,
        teamId: true,
        checkedInAt: true,
      },
    });
  });

  it('rejects a linked member who is not the team captain', async () => {
    const { prisma, service } = harness();
    jest.mocked(prisma.match.findUnique).mockResolvedValue(match() as never);

    await expect(
      service.checkIn('match-1', 'member-1', { teamId: 'team-1' }),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.matchCheckIn.upsert).not.toHaveBeenCalled();
  });

  it('rejects a new check-in before the window opens', async () => {
    const { prisma, service } = harness();
    jest.setSystemTime(new Date('2030-06-15T11:29:59.000Z'));
    jest.mocked(prisma.match.findUnique).mockResolvedValue(match() as never);

    await expect(
      service.checkIn('match-1', 'captain-1', { teamId: 'team-1' }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.matchCheckIn.upsert).not.toHaveBeenCalled();
  });

  it('returns an existing check-in so retries remain idempotent', async () => {
    const { prisma, service } = harness();
    const existing = {
      id: 'check-in-1',
      matchId: 'match-1',
      teamId: 'team-1',
      checkedInAt: new Date('2030-06-15T11:40:00.000Z'),
    };
    jest.setSystemTime(new Date('2030-06-15T12:05:00.000Z'));
    jest
      .mocked(prisma.match.findUnique)
      .mockResolvedValue(
        match({ status: MatchStatus.ONGOING, checkIns: [existing] }) as never,
      );

    await expect(
      service.checkIn('match-1', 'captain-1', { teamId: 'team-1' }),
    ).resolves.toEqual(existing);
    expect(prisma.matchCheckIn.upsert).not.toHaveBeenCalled();
  });
});
