import { Global, Module } from '@nestjs/common';
import { OwnershipGuard } from './guards/ownership.guard';
import { VisibilityGuard } from './guards/visibility.guard';
import { ContentFilterService } from './services/content-filter.service';
import { EmailVerifiedGuard } from './guards/email-verified.guard';
import { CompetitionMutationGuardService } from './services/competition-mutation-guard.service';
import { CompetitionAuditService } from './services/competition-audit.service';
import { COMPETITION_AUDIT_WRITER } from './ports/competition-audit-writer';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TournamentManagementAccessService } from './services/tournament-management-access.service';
import { AdminOverrideAuditInterceptor } from './interceptors/admin-override-audit.interceptor';

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
    CompetitionMutationGuardService,
    CompetitionAuditService,
    TournamentManagementAccessService,
    {
      provide: APP_INTERCEPTOR,
      useClass: AdminOverrideAuditInterceptor,
    },
    {
      provide: COMPETITION_AUDIT_WRITER,
      useExisting: CompetitionAuditService,
    },
  ],
  exports: [
    OwnershipGuard,
    VisibilityGuard,
    EmailVerifiedGuard,
    ContentFilterService,
    CompetitionMutationGuardService,
    CompetitionAuditService,
    TournamentManagementAccessService,
    COMPETITION_AUDIT_WRITER,
  ],
})
export class CommonModule {}
