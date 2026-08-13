import { GUARDS_METADATA } from '@nestjs/common/constants';
import { Role } from '@prisma/client';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { ROLES_KEY } from '../auth/decorators/roles.decorator';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { ContentFilterService } from '../common/services/content-filter.service';
import { NotificationService } from '../notifications/notification.service';

describe('Admin banned keyword authorization', () => {
  it('protects banned keyword APIs with the existing admin guards', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminController)).toEqual([
      JwtAuthGuard,
      RolesGuard,
    ]);
    expect(Reflect.getMetadata(ROLES_KEY, AdminController)).toEqual([
      Role.ADMIN,
    ]);
  });

  it('refreshes the filter cache after an admin adds a keyword', async () => {
    const prisma = {
      bannedKeyword: {
        create: jest.fn().mockResolvedValue({ id: 'k-1', keyword: 'spam' }),
      },
    } as unknown as PrismaService;
    const filter = { refresh: jest.fn().mockResolvedValue(undefined) };
    const service = new AdminService(
      prisma,
      filter as unknown as ContentFilterService,
      {} as NotificationService,
    );

    await service.createBannedKeyword({
      keyword: 'spam',
      category: 'MALICIOUS_LINK',
    });

    expect(filter.refresh).toHaveBeenCalledTimes(1);
  });
});
