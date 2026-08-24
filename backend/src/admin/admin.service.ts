import { Injectable } from '@nestjs/common';
import { ModerationStatus, ReportStatus, Role } from '@prisma/client';
import {
  CreateBannedKeywordDto,
  UpdateBannedKeywordDto,
} from './dto/banned-keyword.dto';
import {
  AdminDashboardQueryService,
  BannedKeywordService,
} from './admin-operations.services';
import { UserAdministrationService } from '../users/user-administration.service';
import { TournamentModerationService } from '../tournaments/tournament-moderation.service';
import { ReportReviewService } from '../reports/report-review.service';
import { CommentModerationService } from '../comments/comment-moderation.service';

/** ADMIN-protected compatibility facade; business behavior is domain-focused. */
@Injectable()
export class AdminService {
  constructor(
    private readonly dashboard: AdminDashboardQueryService,
    private readonly users: UserAdministrationService,
    private readonly tournaments: TournamentModerationService,
    private readonly reports: ReportReviewService,
    private readonly comments: CommentModerationService,
    private readonly keywords: BannedKeywordService,
  ) {}

  listBannedKeywords() {
    return this.keywords.list();
  }
  createBannedKeyword(dto: CreateBannedKeywordDto) {
    return this.keywords.create(dto);
  }
  updateBannedKeyword(id: string, dto: UpdateBannedKeywordDto) {
    return this.keywords.update(id, dto);
  }
  deleteBannedKeyword(id: string) {
    return this.keywords.remove(id);
  }

  listTournaments(moderationStatus?: ModerationStatus) {
    return this.tournaments.list(moderationStatus);
  }
  moderateTournament(id: string, status: ModerationStatus, reason?: string) {
    return this.tournaments.moderate(id, status, reason);
  }
  verifyTournament(id: string, explicit?: boolean) {
    return this.tournaments.verify(id, explicit);
  }

  listReports(status?: ReportStatus) {
    return this.reports.list(status);
  }
  reviewReport(id: string, status: ReportStatus, adminId: string) {
    return this.reports.review(id, status, adminId);
  }

  listComments(query: { isHidden?: boolean; search?: string } = {}) {
    return this.comments.list(query);
  }
  hideComment(id: string) {
    return this.comments.hide(id);
  }
  unhideComment(id: string) {
    return this.comments.unhide(id);
  }
  deleteComment(id: string) {
    return this.comments.remove(id);
  }

  stats() {
    return this.dashboard.stats();
  }
  listUsers(
    page = 1,
    limit = 20,
    filters: { search?: string; isLocked?: boolean; role?: Role } = {},
  ) {
    return this.users.listUsers(page, limit, filters);
  }
  setUserLockStatus(actorAdminId: string, userId: string, isLocked: boolean) {
    return this.users.setUserLockStatus(actorAdminId, userId, isLocked);
  }
}
