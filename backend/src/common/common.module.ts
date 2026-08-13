import { Global, Module } from '@nestjs/common';
import { OwnershipGuard } from './guards/ownership.guard';
import { VisibilityGuard } from './guards/visibility.guard';
import { ContentFilterService } from './services/content-filter.service';

/**
 * Module dùng chung — export các guard để dùng được qua @UseGuards().
 * PrismaModule đã là @Global() nên PrismaService inject được vào guard.
 */
@Global()
@Module({
  providers: [OwnershipGuard, VisibilityGuard, ContentFilterService],
  exports: [OwnershipGuard, VisibilityGuard, ContentFilterService],
})
export class CommonModule {}
