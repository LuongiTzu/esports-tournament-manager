import 'reflect-metadata';
import { ModerationStatus, ReportStatus, Role } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  AdminCommentListQueryDto,
  AdminReportListQueryDto,
  AdminTournamentListQueryDto,
  AdminUsersQueryDto,
} from './admin-query.dto';

describe('admin query DTOs', () => {
  it('accepts canonical enum filters', async () => {
    const queries = [
      plainToInstance(AdminTournamentListQueryDto, {
        moderationStatus: ModerationStatus.ACTIVE,
      }),
      plainToInstance(AdminReportListQueryDto, {
        status: ReportStatus.PENDING,
      }),
      plainToInstance(AdminUsersQueryDto, { role: Role.ADMIN }),
    ];

    for (const query of queries) {
      await expect(validate(query)).resolves.toHaveLength(0);
    }
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
    ];

    for (const query of invalid) {
      expect((await validate(query)).length).toBeGreaterThan(0);
    }
  });
});
