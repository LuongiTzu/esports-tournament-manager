import type { Pagination } from "@/shared/types/pagination";

export const NOTIFICATION_TYPES = [
  "SCHEDULE_CHANGE",
  "SCORE_UPDATE",
  "TEAM_REGISTERED",
  "TEAM_APPROVED",
  "TEAM_REJECTED",
  "TOURNAMENT_STATUS",
  "REPORT_THRESHOLD",
  "ADMIN_WARNING",
  "SYSTEM",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export type NotificationData =
  | {
      kind: "MATCH_RESULT";
      matchId: string;
      matchNumber?: number;
      roundName: string;
      teamAName: string;
      teamBName: string;
      scoreA: number;
      scoreB: number;
    }
  | {
      kind: "MATCH_SCHEDULE";
      matchId: string;
      matchNumber?: number;
      roundName: string;
      teamAName: string;
      teamBName: string;
      oldScheduledAt: string | null;
      newScheduledAt: string | null;
    }
  | {
      kind: "TEAM_REGISTERED";
      teamId: string;
      teamName: string;
    }
  | {
      kind: "TEAM_REVIEW";
      teamId: string;
      teamName: string;
      status: "APPROVED" | "REJECTED";
      rejectReason?: string;
    }
  | {
      kind: "TOURNAMENT_STATUS";
      previousStatus: string;
      status: string;
    }
  | {
      kind: "REPORT_THRESHOLD";
      pendingCount: number;
    }
  | {
      kind: "TOURNAMENT_MODERATION";
      moderationStatus: string;
      reason: string;
    }
  | { kind: "TOURNAMENT_ANNOUNCEMENT" };

export interface NotificationTournament {
  id: string;
  name: string;
  slug: string;
}

export interface NotificationRecord {
  id: string;
  type: NotificationType;
  content: string;
  data: NotificationData | null;
  deduplicationKey: string | null;
  isRead: boolean;
  createdAt: string;
  userId: string;
  tournamentId: string | null;
}

export interface UserNotification extends NotificationRecord {
  tournament: NotificationTournament | null;
}

export type NotificationPagination = Pagination;

export interface NotificationListResponse {
  data: UserNotification[];
  pagination: NotificationPagination;
}

export interface NotificationListQuery {
  page?: number;
  limit?: number;
  isRead?: boolean;
}

export interface UnreadNotificationCount {
  count: number;
}

export interface MarkAllNotificationsReadResult {
  updatedCount: number;
}
