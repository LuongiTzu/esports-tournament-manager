/* eslint-disable @typescript-eslint/unbound-method */
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CompetitionAuditAction, TournamentStaffRole } from '@prisma/client';
import { CompetitionAuditWriter } from '../common/ports/competition-audit-writer';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentStaffService } from './tournament-staff.service';

function harness() {
  const tx = {
    tournament: {
      findUnique: jest.fn().mockResolvedValue({ organizerId: 'owner-1' }),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-2',
        emailVerifiedAt: new Date(),
      }),
    },
    tournamentStaff: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn(),
      create: jest.fn().mockResolvedValue({
        id: 'staff-1',
        role: TournamentStaffRole.REFEREE,
        createdAt: new Date(),
        user: {
          id: 'user-2',
          email: 'ref@example.com',
          displayName: 'Referee',
          avatarUrl: null,
        },
      }),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const prisma = {
    tournamentStaff: { findMany: jest.fn() },
    $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
      callback(tx),
    ),
  } as unknown as PrismaService;
  const audit = { record: jest.fn() } as unknown as CompetitionAuditWriter;
  return { service: new TournamentStaffService(prisma, audit), tx, audit };
}

describe('TournamentStaffService', () => {
  it('adds a verified user and records the assignment', async () => {
    const { service, tx, audit } = harness();
    await expect(
      service.add('tournament-1', 'owner-1', {
        email: ' REF@example.com ',
        role: TournamentStaffRole.REFEREE,
      }),
    ).resolves.toEqual(expect.objectContaining({ id: 'staff-1' }));
    expect(tx.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: 'ref@example.com' } }),
    );
    expect(audit.record).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        action: CompetitionAuditAction.TOURNAMENT_STAFF_ADDED,
      }),
    );
  });

  it('rejects the owner and duplicate staff assignments', async () => {
    const owner = harness();
    jest.mocked(owner.tx.user.findUnique).mockResolvedValue({
      id: 'owner-1',
      emailVerifiedAt: new Date(),
    });
    await expect(
      owner.service.add('tournament-1', 'owner-1', {
        email: 'owner@example.com',
        role: TournamentStaffRole.CO_ORGANIZER,
      }),
    ).rejects.toBeInstanceOf(ConflictException);

    const duplicate = harness();
    jest
      .mocked(duplicate.tx.tournamentStaff.findUnique)
      .mockResolvedValue({ id: 'staff-1' });
    await expect(
      duplicate.service.add('tournament-1', 'owner-1', {
        email: 'ref@example.com',
        role: TournamentStaffRole.REFEREE,
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('does not reveal an unverified or unknown account', async () => {
    const { service, tx } = harness();
    jest.mocked(tx.user.findUnique).mockResolvedValue(null);
    await expect(
      service.add('tournament-1', 'owner-1', {
        email: 'missing@example.com',
        role: TournamentStaffRole.SCOREKEEPER,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
