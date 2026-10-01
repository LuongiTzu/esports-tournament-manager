import { SetMetadata } from '@nestjs/common';
import { TournamentStaffRole } from '@prisma/client';

export const TOURNAMENT_STAFF_ROLES_KEY = 'tournament_staff_roles';

export const TournamentStaffRoles = (...roles: TournamentStaffRole[]) =>
  SetMetadata(TOURNAMENT_STAFF_ROLES_KEY, roles);
