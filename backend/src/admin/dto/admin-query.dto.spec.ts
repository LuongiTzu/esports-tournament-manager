import 'reflect-metadata';
import {
  ModerationStatus,
  ReportStatus,
  Role,
  TournamentStatus,
} from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AdminCommentListQueryDto,
  AdminDashboardQueryDto,
  AdminReportListQueryDto,
  AdminTournamentListQueryDto,
  AdminUsersQueryDto,
} from './admin-query.dto';

describe('admin query DTOs', () => {
  it('accepts canonical enum filters', async () => {
    const dashboardQuery = plainToInstance(AdminDashboardQueryDto, {
      periodDays: '30',
    });
    const queries = [
      plainToInstance(AdminTournamentListQueryDto, {
        search: 'arena',
        gameId: 'game-1',
        status: TournamentStatus.ONGOING,
        moderationStatus: ModerationStatus.ACTIVE,
      }),
      plainToInstance(AdminReportListQueryDto, {
        status: ReportStatus.PENDING,
      }),
      plainToInstance(AdminUsersQueryDto, { role: Role.ADMIN }),
      dashboardQuery,
    ];

    for (const query of queries) {
      await expect(validate(query)).resolves.toHaveLength(0);
    }
    expect(dashboardQuery.periodDays).toBe(30);
  });

  it.each([
    ['true', true],
    ['false', false],
  ] as const)('handles boolean query value %s', async (raw, expected) => {
    const commentQuery = plainToInstance(AdminCommentListQueryDto, {
      isHidden: raw,
    });
    const userQuery = plainToInstance(AdminUsersQueryDto, { isLocked: raw });

    await expect(validate(commentQuery)).resolves.toHaveLength(0);
    await expect(validate(userQuery)).resolves.toHaveLength(0);
    expect(commentQuery.isHidden).toBe(expected);
    expect(userQuery.isLocked).toBe(expected);
  });

  it('rejects invalid boolean and enum filters', async () => {
    const invalid = [
      plainToInstance(AdminCommentListQueryDto, { isHidden: 'yes' }),
      plainToInstance(AdminUsersQueryDto, { role: 'SUPERUSER' }),
      plainToInstance(AdminTournamentListQueryDto, { status: 'UNKNOWN' }),
      plainToInstance(AdminDashboardQueryDto, { periodDays: '14' }),
    ];

    for (const query of invalid) {
      expect((await validate(query)).length).toBeGreaterThan(0);
    }
  });
});
