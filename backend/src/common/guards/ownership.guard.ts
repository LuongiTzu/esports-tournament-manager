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

/**
 * Guard kiểm tra quyền sở hữu tài nguyên.
 * Mặc định param chứa ID tài nguyên là "id".
 * Dùng kèm decorator @Ownership('paramName') để chỉ định param chứa ID.
 *
 * Hỗ trợ prefix "tournament:" để kiểm tra quyền sở hữu giải đấu:
 *   - tournament:query  → tìm tournament theo slug trong query (?t=xxxx)
 *   - tournament:{param} → tìm tournament theo ID trong param
 */
@Injectable()
export class OwnershipGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService,
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
      throw new ForbiddenException(
        'Bạn không có quyền thực hiện thao tác này trên giải đấu',
      );
    }

    return true;
  }
}
