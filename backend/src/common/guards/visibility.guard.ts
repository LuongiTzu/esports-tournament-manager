import {
  CanActivate,
  ExecutionContext,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { ModerationStatus, Visibility } from '@prisma/client';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { VISIBILITY_RESOURCE_KEY } from '../decorators/visibility.decorator';
import { tournamentVisibilityPolicy } from '../policies/tournament-visibility.policy';

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
    if (tournamentVisibilityPolicy.canView({ ...tournament, user })) {
      return true;
    }
    if (
      !user ||
      tournament.visibility !== Visibility.PRIVATE ||
      tournament.moderationStatus === ModerationStatus.HIDDEN_BY_ADMIN
    ) {
      this.deny();
    }

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
    if (
      !tournamentVisibilityPolicy.canView({
        ...tournament,
        user,
        isRelatedParticipant: belongsToTeam !== null,
      })
    ) {
      this.deny();
    }
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
    if (resource?.startsWith('team:')) {
      return this.prisma.team
        .findUnique({
          where: { id: params[resource.slice(5)] },
          select: { tournament: { select: visibilitySelect } },
        })
        .then((team) => team?.tournament ?? null);
    }
    if (resource?.startsWith('round:')) {
      return this.prisma.round
        .findUnique({
          where: { id: params[resource.slice(6)] },
          select: { tournament: { select: visibilitySelect } },
        })
        .then((round) => round?.tournament ?? null);
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
