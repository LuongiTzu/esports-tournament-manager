import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModerationStatus, Role, Visibility } from '@prisma/client';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { VISIBILITY_RESOURCE_KEY } from '../decorators/visibility.decorator';

@Injectable()
export class VisibilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const resource = this.reflector.getAllAndOverride<string>(
      VISIBILITY_RESOURCE_KEY,
      [context.getHandler(), context.getClass()],
    );
    const request = context.switchToHttp().getRequest<{
      user?: AuthenticatedUser;
      params: Record<string, string>;
    }>();

    const tournament = await this.resolveTournament(resource, request.params);
    if (!tournament) {
      throw new NotFoundException('Không tìm thấy giải đấu');
    }
    const user = request.user;
    const isAdmin = user?.role === Role.ADMIN;
    const isOrganizer = user?.id === tournament.organizerId;

    if (tournament.moderationStatus === ModerationStatus.HIDDEN_BY_ADMIN) {
      if (!isAdmin && !isOrganizer) this.deny();
      return true;
    }
    if (tournament.visibility === Visibility.PUBLIC) return true;
    if (!user) this.deny();
    if (isAdmin || isOrganizer) return true;

    const belongsToTeam = await this.prisma.team.findFirst({
      where: {
        tournamentId: tournament.id,
        OR: [
          { captainId: user.id },
          { members: { some: { userId: user.id } } },
        ],
      },
      select: { id: true },
    });
    if (!belongsToTeam) this.deny();
    return true;
  }

  private resolveTournament(
    resource: string | undefined,
    params: Record<string, string>,
  ) {
    const visibilitySelect = {
      id: true,
      organizerId: true,
      visibility: true,
      moderationStatus: true,
    } as const;
    if (resource?.startsWith('match:')) {
      return this.prisma.match
        .findUnique({
          where: { id: params[resource.slice(6)] },
          select: {
            round: { select: { tournament: { select: visibilitySelect } } },
          },
        })
        .then((match) => match?.round.tournament ?? null);
    }
    const slugParam = resource?.startsWith('slug:')
      ? resource.slice(5)
      : 'slug';
    return this.prisma.tournament.findUnique({
      where: { slug: params[slugParam] },
      select: visibilitySelect,
    });
  }

  private deny(): never {
    throw new NotFoundException('Không tìm thấy giải đấu');
  }
}
