import { Injectable } from '@nestjs/common';
import { Role, TournamentAdminOverrideStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export const ACTIVE_ADMIN_OVERRIDE_SELECT = {
  id: true,
  reason: true,
  status: true,
  startedAt: true,
  expiresAt: true,
  endedAt: true,
  tournamentId: true,
  adminId: true,
  admin: {
    select: { id: true, displayName: true, email: true },
  },
} as const;

@Injectable()
export class TournamentManagementAccessService {
  constructor(private readonly prisma: PrismaService) {}

  findActiveOverride(tournamentId: string) {
    return this.prisma.tournamentAdminOverride.findFirst({
      where: {
        tournamentId,
        status: TournamentAdminOverrideStatus.ACTIVE,
        expiresAt: { gt: new Date() },
      },
      orderBy: { startedAt: 'desc' },
      select: ACTIVE_ADMIN_OVERRIDE_SELECT,
    });
  }

  findActiveOverrideForAdmin(
    tournamentId: string,
    adminId: string,
    actorRole?: string,
  ) {
    if (actorRole !== undefined && actorRole !== Role.ADMIN) {
      return Promise.resolve(null);
    }
    return this.prisma.tournamentAdminOverride.findFirst({
      where: {
        tournamentId,
        adminId,
        status: TournamentAdminOverrideStatus.ACTIVE,
        expiresAt: { gt: new Date() },
        ...(actorRole === undefined ? { admin: { role: Role.ADMIN } } : {}),
      },
      select: ACTIVE_ADMIN_OVERRIDE_SELECT,
    });
  }
}
