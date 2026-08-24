export const NOTIFICATION_TYPES = [
  "SCHEDULE_CHANGE",
  "SCORE_UPDATE",
  "TEAM_APPROVED",
  "TEAM_REJECTED",
  "ADMIN_WARNING",
  "SYSTEM",
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

export interface NotificationTournament {
  id: string;
  name: string;
  slug: string;
}

export interface NotificationRecord {
  id: string;
  type: NotificationType;
  content: string;
  deduplicationKey: string | null;
  isRead: boolean;
  createdAt: string;
  userId: string;
  tournamentId: string | null;
}

export interface UserNotification extends NotificationRecord {
  tournament: NotificationTournament | null;
}

export interface NotificationPagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

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
