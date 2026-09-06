/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { CallHandler, ExecutionContext } from '@nestjs/common';
import { CompetitionAuditAction } from '@prisma/client';
import { lastValueFrom, of } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminOverrideAuditInterceptor } from './admin-override-audit.interceptor';

describe('AdminOverrideAuditInterceptor', () => {
  it('records a successful override mutation', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'audit-1' });
    const interceptor = new AdminOverrideAuditInterceptor({
      competitionAuditLog: { create },
    } as unknown as PrismaService);
    const context = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'PATCH',
          baseUrl: '/api',
          route: { path: '/matches/:id' },
          body: { scoreA: 2, scoreB: 1 },
          adminOverrideAccess: {
            id: 'override-1',
            tournamentId: 't-1',
            adminId: 'admin-1',
            reason: 'Emergency score correction requested',
          },
        }),
      }),
    } as unknown as ExecutionContext;
    const next = { handle: () => of({ id: 'match-1' }) } as CallHandler;

    await expect(
      lastValueFrom(interceptor.intercept(context, next)),
    ).resolves.toEqual({ id: 'match-1' });
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        tournamentId: 't-1',
        actorId: 'admin-1',
        action: CompetitionAuditAction.ADMIN_OVERRIDE_ACTION,
        details: expect.objectContaining({
          overrideId: 'override-1',
          path: '/api/matches/:id',
          payload: { scoreA: 2, scoreB: 1 },
        }),
      }),
    });
  });
});
