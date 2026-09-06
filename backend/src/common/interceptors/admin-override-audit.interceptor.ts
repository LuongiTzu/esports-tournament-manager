import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { CompetitionAuditAction, Prisma } from '@prisma/client';
import { Observable, mergeMap } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import type { ActiveAdminOverrideAccess } from '../types/admin-override-access';

@Injectable()
export class AdminOverrideAuditInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<{
      method: string;
      baseUrl?: string;
      route?: { path?: string };
      url?: string;
      body?: Prisma.InputJsonObject;
      adminOverrideAccess?: ActiveAdminOverrideAccess;
    }>();
    const override = request.adminOverrideAccess;

    if (!override || ['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
      return next.handle();
    }

    return next.handle().pipe(
      mergeMap(async (result: unknown) => {
        await this.prisma.competitionAuditLog.create({
          data: {
            tournamentId: override.tournamentId,
            actorId: override.adminId,
            action: CompetitionAuditAction.ADMIN_OVERRIDE_ACTION,
            details: {
              overrideId: override.id,
              overrideReason: override.reason,
              method: request.method,
              path:
                request.route?.path !== undefined
                  ? `${request.baseUrl ?? ''}${request.route.path}`
                  : (request.url?.split('?')[0] ?? ''),
              payload: request.body ?? {},
            },
          },
        });
        return result;
      }),
    );
  }
}
