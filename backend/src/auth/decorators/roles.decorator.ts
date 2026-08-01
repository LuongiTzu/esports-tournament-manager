import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator để gán vai trò yêu cầu cho route.
 * Dùng cùng với RolesGuard.
 *
 * @example
 * @Roles(Role.ADMIN)
 * @UseGuards(JwtAuthGuard, RolesGuard)
 * async myAdminRoute() {}
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
