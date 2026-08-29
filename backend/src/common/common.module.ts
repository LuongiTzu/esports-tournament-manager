import { Global, Module } from '@nestjs/common';
import { OwnershipGuard } from './guards/ownership.guard';
import { VisibilityGuard } from './guards/visibility.guard';
import { ContentFilterService } from './services/content-filter.service';
import { EmailVerifiedGuard } from './guards/email-verified.guard';

/**
 * Module dùng chung — export các guard để dùng được qua @UseGuards().
 * PrismaModule đã là @Global() nên PrismaService inject được vào guard.
 */
@Global()
@Module({
  providers: [
    OwnershipGuard,
    VisibilityGuard,
    EmailVerifiedGuard,
    ContentFilterService,
  ],
  exports: [
    OwnershipGuard,
    VisibilityGuard,
    EmailVerifiedGuard,
    ContentFilterService,
  ],
})
export class CommonModule {}
