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
 * Guard kiểm tra người dùng hiện tại là captain hoặc thành viên của đội.
 * Mặc định param chứa teamId là "id" — dùng @Ownership('teamId') để chỉ định.
 */
@Injectable()
export class TeamMemberGuard implements CanActivate {
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
    }>();

    const user = request.user;
    if (!user) {
      throw new ForbiddenException('Bạn chưa đăng nhập');
    }

    const teamId = request.params[paramName];
    if (!teamId) {
      throw new NotFoundException('Không tìm thấy đội');
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        captainId: true,
        members: {
          where: { userId: user.id },
          select: { id: true },
        },
      },
    });

    if (!team) {
      throw new NotFoundException('Không tìm thấy đội');
    }

    // Captain hoặc thành viên trong đội đều được phép
    const isCaptain = team.captainId === user.id;
    const isMember = team.members.length > 0;

    if (!isCaptain && !isMember) {
      throw new ForbiddenException('Bạn không có quyền thao tác trên đội này');
    }

    return true;
  }
}
