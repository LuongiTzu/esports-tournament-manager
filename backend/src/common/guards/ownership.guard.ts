import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../prisma/prisma.service';
import { OWNERSHIP_PARAM_KEY } from '../decorators/ownership.decorator';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { Role } from '@prisma/client';
import { ALLOW_ADMIN_OVERRIDE_KEY } from '../decorators/allow-admin-override.decorator';
import { TournamentManagementAccessService } from '../services/tournament-management-access.service';
import type { ActiveAdminOverrideAccess } from '../types/admin-override-access';

/**
 * Guard kiểm tra quyền sở hữu tài nguyên.
 * Mặc định param chứa ID tài nguyên là "id".
 * Dùng kèm decorator @Ownership('paramName') để chỉ định param chứa ID.
 *
 * Hỗ trợ prefix "tournament:" để kiểm tra quyền sở hữu giải đấu:
 *   - tournament:query  → tìm tournament theo slug trong query (?t=xxxx)
 *   - tournament:{param} → tìm tournament theo ID trong param
 *
 * Dùng "slug:{param}" khi route định danh giải bằng slug thay vì ID.
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
    private readonly managementAccess: TournamentManagementAccessService = new TournamentManagementAccessService(
      prisma,
    ),
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const paramName =
      this.reflector.getAllAndOverride<string>(OWNERSHIP_PARAM_KEY, [
        context.getHandler(),
        context.getClass(),
      ]) ?? 'id';

    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      params: Record<string, string>;
      query: Record<string, string>;
      body?: { matches?: unknown };
      adminOverrideAccess?: ActiveAdminOverrideAccess;
    }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Bạn chưa đăng nhập');
    }

    let tournamentId: string | undefined;

    if (paramName === 'query') {
      // Tìm giải đấu theo slug trong query string (dùng cho route public/guest)
      const slug = request.query.t;
      if (!slug) {
        throw new NotFoundException('Thiếu tham số tìm kiếm giải đấu');
      }
      const tournament = await this.prisma.tournament.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!tournament) {
        throw new NotFoundException('Không tìm thấy giải đấu');
      }
      tournamentId = tournament.id;
    } else if (paramName === 'matches:body') {
      const items = request.body?.matches;
      if (!Array.isArray(items)) {
        throw new NotFoundException('Khong tim thay tran dau');
      }
      const matchIds = items.map((item) =>
        typeof item === 'object' && item !== null && 'matchId' in item
          ? (item as { matchId?: unknown }).matchId
          : undefined,
      );
      if (
        !matchIds.length ||
        matchIds.some((id): id is Exclude<typeof id, string> =>
          Boolean(typeof id !== 'string' || !id),
        )
      ) {
        throw new NotFoundException('Khong tim thay tran dau');
      }
      const matches = await this.prisma.match.findMany({
        where: { id: { in: matchIds as string[] } },
        select: { id: true, round: { select: { tournamentId: true } } },
      });
      if (matches.length !== new Set(matchIds).size) {
        throw new NotFoundException('Khong tim thay tran dau');
      }
      const tournamentIds = new Set(
        matches.map((match) => match.round.tournamentId),
      );
      if (tournamentIds.size !== 1) {
        throw new ForbiddenException(
          'Tat ca tran dau phai thuoc cung mot giai dau',
        );
      }
      tournamentId = matches[0].round.tournamentId;
    } else if (paramName.startsWith('match:')) {
      const matchId = request.params[paramName.slice(6)];
      const match = await this.prisma.match.findUnique({
        where: { id: matchId },
        select: { round: { select: { tournamentId: true } } },
      });
      if (!match) {
        throw new NotFoundException('Khong tim thay tran dau');
      }
      tournamentId = match.round.tournamentId;
    } else if (paramName.startsWith('round:')) {
      const roundId = request.params[paramName.slice(6)];
      const round = await this.prisma.round.findUnique({
        where: { id: roundId },
        select: { tournamentId: true },
      });
      if (!round) {
        throw new NotFoundException('Không tìm thấy vòng đấu');
      }
      tournamentId = round.tournamentId;
    } else if (paramName.startsWith('invitation:')) {
      const invitationId = request.params[paramName.slice(11)];
      const invitation = await this.prisma.teamInvitation.findUnique({
        where: { id: invitationId },
        select: { tournamentId: true },
      });
      if (!invitation) {
        throw new NotFoundException('Không tìm thấy lời mời');
      }
      tournamentId = invitation.tournamentId;
    } else if (paramName.startsWith('slug:')) {
      // Route định danh giải bằng slug, VD @Ownership('slug:slug')
      const slug = request.params[paramName.slice(5)];
      const tournament = await this.prisma.tournament.findUnique({
        where: { slug },
        select: { id: true },
      });
      if (!tournament) {
        throw new NotFoundException('Không tìm thấy giải đấu');
      }
      tournamentId = tournament.id;
    } else {
      tournamentId = request.params[paramName];
    }

    if (!tournamentId) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
      select: { organizerId: true },
    });

    if (!tournament) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }

    if (tournament.organizerId !== user.id) {
      const allowAdminOverride = this.reflector.getAllAndOverride<boolean>(
        ALLOW_ADMIN_OVERRIDE_KEY,
        [context.getHandler(), context.getClass()],
      );
      if (allowAdminOverride === true && user.role === Role.ADMIN) {
        const activeOverride =
          await this.managementAccess.findActiveOverrideForAdmin(
            tournamentId,
            user.id,
            user.role,
          );
        if (activeOverride) {
          request.adminOverrideAccess = {
            id: activeOverride.id,
            tournamentId: activeOverride.tournamentId,
            adminId: activeOverride.adminId,
            reason: activeOverride.reason,
          };
          return true;
        }
      }
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện thao tác này trên giải đấu',
      );
    }

    return true;
  }
}
