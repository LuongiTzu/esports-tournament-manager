import { Module } from '@nestjs/common';
import { OwnershipGuard } from './guards/ownership.guard';

/**
 * Module dùng chung — export các guard để dùng được qua @UseGuards().
 * PrismaModule đã là @Global() nên PrismaService inject được vào guard.
 */
@Module({
  providers: [OwnershipGuard],
  exports: [OwnershipGuard],
})
export class CommonModule {}
