import { Module } from '@nestjs/common';
import { OwnershipGuard } from './guards/ownership.guard';
import { TeamMemberGuard } from './guards/team-member.guard';

/**
 * Module dùng chung — export các guard để dùng được qua @UseGuards().
 * PrismaModule đã là @Global() nên PrismaService inject được vào guard.
 */
@Module({
  providers: [OwnershipGuard, TeamMemberGuard],
  exports: [OwnershipGuard, TeamMemberGuard],
})
export class CommonModule {}
