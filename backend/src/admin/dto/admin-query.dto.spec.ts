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
    [AdminCommentListQueryDto, 'isHidden'],
    [AdminUsersQueryDto, 'isLocked'],
  ] as const)('handles true and false for %s', async (Dto, field) => {
    for (const [raw, expected] of [
      ['true', true],
      ['false', false],
    ] as const) {
      const query = plainToInstance(Dto, { [field]: raw });
      await expect(validate(query)).resolves.toHaveLength(0);
      expect(query[field]).toBe(expected);
    }
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
