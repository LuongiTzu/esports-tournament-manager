import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  NotFoundException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';

export type TeamAccessLevel = 'ORGANIZER' | 'CAPTAIN' | 'CAPTAIN_OR_ORGANIZER';

export const TEAM_ACCESS_KEY = 'team_access';

/**
 * Mức quyền cần có trên đội ở route `/teams/:id`.
 * - `ORGANIZER` — chỉ BTC của giải chứa đội (duyệt/từ chối)
 * - `CAPTAIN` — chỉ đội trưởng (rút đăng ký)
 * - `CAPTAIN_OR_ORGANIZER` — cả hai (sửa hồ sơ, quản lý roster)
 */
export const TeamAccess = (level: TeamAccessLevel) =>
  SetMetadata(TEAM_ACCESS_KEY, level);

/**
 * Guard cho các route thao tác trên 1 đội cụ thể.
 * Nạp sẵn đội vào `request.team` để service không phải query lại.
 */
@Injectable()
export class TeamAccessGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const level =
      this.reflector.getAllAndOverride<TeamAccessLevel>(TEAM_ACCESS_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'CAPTAIN_OR_ORGANIZER';

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      params: Record<string, string>;
      team?: unknown;
    }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Bạn chưa đăng nhập');
    }

    const team = await this.prisma.team.findUnique({
      where: { id: request.params.id },
      select: {
        id: true,
        captainId: true,
        status: true,
        tournamentId: true,
        tournament: { select: { organizerId: true, status: true } },
      },
    });

    if (!team) {
      throw new NotFoundException('Không tìm thấy đội');
    }

    const isCaptain = team.captainId === user.id;
    const isOrganizer = team.tournament.organizerId === user.id;

    const allowed =
      level === 'ORGANIZER'
        ? isOrganizer
        : level === 'CAPTAIN'
          ? isCaptain
          : isCaptain || isOrganizer;

    if (!allowed) {
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện thao tác này trên đội',
      );
    }

    request.team = team;
    return true;
  }
}
