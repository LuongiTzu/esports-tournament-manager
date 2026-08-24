import type {
  MarkAllNotificationsReadResult,
  NotificationRecord,
  NotificationListQuery,
  NotificationListResponse,
  UnreadNotificationCount,
} from "@/features/notifications/types";
import { request } from "@/lib/api/client";

export const notificationsApi = {
  findMine: (query: NotificationListQuery = {}) => {
    const params = new URLSearchParams();
    if (query.page) params.set("page", String(query.page));
    if (query.limit) params.set("limit", String(query.limit));
    if (query.isRead !== undefined) {
      params.set("isRead", String(query.isRead));
    }
    const search = params.toString();
    return request<NotificationListResponse>(
      `/users/me/notifications${search ? `?${search}` : ""}`,
      { auth: true },
    );
  },
  unreadCount: () =>
    request<UnreadNotificationCount>("/users/me/notifications/unread-count", {
      auth: true,
    }),
  markRead: (notificationId: string) =>
    request<NotificationRecord>(`/notifications/${notificationId}/read`, {
      method: "PATCH",
      auth: true,
    }),
  markAllRead: () =>
    request<MarkAllNotificationsReadResult>("/notifications/read-all", {
      method: "PATCH",
      auth: true,
    }),
};
