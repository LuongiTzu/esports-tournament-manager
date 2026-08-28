"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BellIcon,
  CalendarDotsIcon,
  ChatCircleDotsIcon,
  CheckCircleIcon,
  ChecksIcon,
  CircleNotchIcon,
  InfoIcon,
  ShieldWarningIcon,
  TrophyIcon,
  WarningCircleIcon,
  XCircleIcon,
} from "@phosphor-icons/react";
import { useAuth } from "@/features/auth/store";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { formatLocalizedDate } from "@/features/locale/format";
import { notificationsApi } from "@/features/notifications/api";
import type {
  NotificationPagination,
  NotificationType,
  UserNotification,
} from "@/features/notifications/types";
import { useNotificationRealtime } from "@/features/realtime/provider";

const PAGE_SIZE = 10;

const TYPE_META: Record<
  NotificationType,
  { titleKey: TranslationKey; icon: typeof BellIcon; tone: string }
> = {
  SCHEDULE_CHANGE: {
    titleKey: "notifications.type.schedule",
    icon: CalendarDotsIcon,
    tone: "bg-brand/10 text-brand",
  },
  SCORE_UPDATE: {
    titleKey: "notifications.type.score",
    icon: TrophyIcon,
    tone: "bg-accent/10 text-accent",
  },
  TEAM_REGISTERED: {
    titleKey: "notifications.type.registered",
    icon: InfoIcon,
    tone: "bg-brand/10 text-brand",
  },
  TEAM_APPROVED: {
    titleKey: "notifications.type.approved",
    icon: CheckCircleIcon,
    tone: "bg-approved/10 text-approved",
  },
  TEAM_REJECTED: {
    titleKey: "notifications.type.rejected",
    icon: XCircleIcon,
    tone: "bg-rejected/10 text-rejected",
  },
  TOURNAMENT_STATUS: {
    titleKey: "notifications.type.tournamentStatus",
    icon: InfoIcon,
    tone: "bg-accent/10 text-accent",
  },
  REPORT_THRESHOLD: {
    titleKey: "notifications.type.reportThreshold",
    icon: ShieldWarningIcon,
    tone: "bg-pending/10 text-pending",
  },
  ADMIN_WARNING: {
    titleKey: "notifications.type.adminWarning",
    icon: ShieldWarningIcon,
    tone: "bg-pending/10 text-pending",
  },
  COMMENT_REPLY: {
    titleKey: "notifications.type.commentReply",
    icon: ChatCircleDotsIcon,
    tone: "bg-accent/10 text-accent",
  },
  SYSTEM: {
    titleKey: "notifications.type.system",
    icon: InfoIcon,
    tone: "bg-surface-sub text-ink-muted",
  },
};

function mergeNotifications(
  current: UserNotification[],
  incoming: UserNotification[],
) {
  const byId = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => byId.set(item.id, item));
  return [...byId.values()].sort(
    (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt),
  );
}

function notificationCopy(
  notification: UserNotification,
  t: (key: TranslationKey) => string,
  locale: "vi" | "en",
): { message: string; detail?: string } {
  const data = asRecord(notification.data);
  if (data?.kind === "MATCH_RESULT") {
    const teamA = stringField(data, "teamAName");
    const teamB = stringField(data, "teamBName");
    const scoreA = numberField(data, "scoreA");
    const scoreB = numberField(data, "scoreB");
    if (teamA && teamB && scoreA !== null && scoreB !== null) {
      return {
        message: interpolate(t("notifications.message.matchResult"), {
          teamA,
          teamB,
          scoreA,
          scoreB,
        }),
        detail: stringField(data, "roundName") ?? undefined,
      };
    }
  }
  if (data?.kind === "MATCH_SCHEDULE") {
    const teamA = stringField(data, "teamAName");
    const teamB = stringField(data, "teamBName");
    if (teamA && teamB) {
      const newTime = stringField(data, "newScheduledAt");
      return {
        message: interpolate(t("notifications.message.matchSchedule"), {
          teamA,
          teamB,
        }),
        detail: newTime
          ? interpolate(t("notifications.message.scheduleAt"), {
              time: formatLocalizedDate(newTime, locale, {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
              }),
            })
          : t("notifications.message.scheduleRemoved"),
      };
    }
  }
  if (data?.kind === "TEAM_REGISTERED") {
    const team = stringField(data, "teamName");
    if (team) {
      return {
        message: interpolate(t("notifications.message.teamRegistered"), {
          team,
        }),
      };
    }
  }
  if (data?.kind === "TEAM_REVIEW") {
    const team = stringField(data, "teamName");
    const status = stringField(data, "status");
    if (team && (status === "APPROVED" || status === "REJECTED")) {
      const reason = stringField(data, "rejectReason");
      return {
        message: interpolate(
          t(
            status === "APPROVED"
              ? "notifications.message.teamApproved"
              : "notifications.message.teamRejected",
          ),
          { team },
        ),
        detail:
          status === "REJECTED" && reason
            ? interpolate(t("notifications.message.rejectReason"), { reason })
            : undefined,
      };
    }
  }
  if (data?.kind === "TOURNAMENT_STATUS") {
    const status = stringField(data, "status");
    const statusKeys: Record<string, TranslationKey> = {
      DRAFT: "notifications.status.DRAFT",
      REGISTRATION: "notifications.status.REGISTRATION",
      ONGOING: "notifications.status.ONGOING",
      COMPLETED: "notifications.status.COMPLETED",
      CANCELLED: "notifications.status.CANCELLED",
    };
    if (status && statusKeys[status]) {
      return {
        message: interpolate(t("notifications.message.tournamentStatus"), {
          status: t(statusKeys[status]),
        }),
      };
    }
  }
  if (data?.kind === "REPORT_THRESHOLD") {
    const count = numberField(data, "pendingCount");
    if (count !== null) {
      return {
        message: interpolate(t("notifications.message.reportThreshold"), {
          count,
        }),
      };
    }
  }
  if (data?.kind === "TOURNAMENT_MODERATION") {
    const reason = stringField(data, "reason");
    return {
      message: t("notifications.message.moderationHidden"),
      detail: reason
        ? interpolate(t("notifications.message.moderationReason"), { reason })
        : undefined,
    };
  }
  if (data?.kind === "COMMENT_REPLY") {
    const replierName = stringField(data, "replierName");
    const preview = stringField(data, "replyPreview");
    if (replierName) {
      return {
        message: interpolate(t("notifications.message.commentReply"), {
          replier: `@${replierName}`,
        }),
        detail: preview ? `“${preview}”` : undefined,
      };
    }
  }
  if (notification.type === "SCORE_UPDATE") {
    return { message: t("notifications.message.scoreUpdated") };
  }
  if (notification.type === "SCHEDULE_CHANGE") {
    return { message: t("notifications.message.scheduleUpdated") };
  }
  return { message: notification.content };
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function stringField(data: Record<string, unknown>, key: string) {
  return typeof data[key] === "string" ? data[key] : null;
}

function numberField(data: Record<string, unknown>, key: string) {
  return typeof data[key] === "number" ? data[key] : null;
}

function interpolate(
  template: string,
  values: Record<string, string | number>,
) {
  return template.replace(/\{(\w+)\}/g, (placeholder, key: string) =>
    values[key] === undefined ? placeholder : String(values[key]),
  );
}

function notificationDestination(notification: UserNotification) {
  if (notification.type === "REPORT_THRESHOLD") return "/admin/reports";
  const slug = notification.tournament?.slug;
  if (!slug) return null;
  if (notification.type === "COMMENT_REPLY") {
    const data = asRecord(notification.data);
    const rootCommentId = data ? stringField(data, "rootCommentId") : null;
    return rootCommentId
      ? `/tournaments/${slug}#comment-${encodeURIComponent(rootCommentId)}`
      : `/tournaments/${slug}#comments`;
  }
  if (
    notification.type === "TEAM_REGISTERED" ||
    notification.type === "ADMIN_WARNING"
  ) {
    return `/tournaments/${slug}/manage`;
  }
  if (
    notification.type === "SCORE_UPDATE" ||
    notification.type === "SCHEDULE_CHANGE"
  ) {
    return `/tournaments/${slug}#competition`;
  }
  return `/tournaments/${slug}`;
}

function AuthenticatedNotificationCenter() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
  const refreshRequestId = useRef(0);
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<UserNotification[]>([]);
  const [pagination, setPagination] = useState<NotificationPagination | null>(
    null,
  );
  const [unreadCount, setUnreadCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);
  const [markingIds, setMarkingIds] = useState<Set<string>>(new Set());
  const [error, setError] = useState("");

  const refresh = useCallback(
    async (silent = false) => {
      const requestId = ++refreshRequestId.current;
      if (!silent) setLoading(true);
      setError("");
      try {
        const [list, unread] = await Promise.all([
          notificationsApi.findMine({ page: 1, limit: PAGE_SIZE }),
          notificationsApi.unreadCount(),
        ]);
        if (requestId !== refreshRequestId.current) return;
        setNotifications(list.data);
        setPagination(list.pagination);
        setUnreadCount(unread.count);
      } catch (reason) {
        if (requestId !== refreshRequestId.current) return;
        setError(
          reason instanceof Error
            ? reason.message
            : t("notifications.loadError"),
        );
      } finally {
        if (requestId === refreshRequestId.current) setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => {
      window.clearTimeout(timer);
      refreshRequestId.current += 1;
    };
  }, [refresh]);

  useNotificationRealtime(() => void refresh(true));

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const loadMore = async () => {
    if (!pagination || pagination.page >= pagination.totalPages || loadingMore)
      return;
    setLoadingMore(true);
    setError("");
    const refreshIdAtStart = refreshRequestId.current;
    try {
      const next = await notificationsApi.findMine({
        page: pagination.page + 1,
        limit: pagination.limit,
      });
      if (refreshIdAtStart !== refreshRequestId.current) return;
      setNotifications((current) => mergeNotifications(current, next.data));
      setPagination(next.pagination);
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("notifications.loadError"),
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const openNotification = async (notification: UserNotification) => {
    if (markingIds.has(notification.id)) return;
    if (!notification.isRead) {
      setMarkingIds((current) => new Set(current).add(notification.id));
      try {
        await notificationsApi.markRead(notification.id);
        setNotifications((current) =>
          current.map((item) =>
            item.id === notification.id ? { ...item, isRead: true } : item,
          ),
        );
        setUnreadCount((await notificationsApi.unreadCount()).count);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : t("notifications.readError"),
        );
        return;
      } finally {
        setMarkingIds((current) => {
          const next = new Set(current);
          next.delete(notification.id);
          return next;
        });
      }
    }
    const destination = notificationDestination(notification);
    if (destination) {
      setOpen(false);
      router.push(destination);
    }
  };

  const markAllRead = async () => {
    if (!unreadCount || markingAll) return;
    setMarkingAll(true);
    setError("");
    try {
      await notificationsApi.markAllRead();
      await refresh();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : t("notifications.readError"),
      );
    } finally {
      setMarkingAll(false);
    }
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <button
        type="button"
        aria-label={t("notifications.title")}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen((value) => !value)}
        className="relative grid size-10 place-items-center rounded-xl text-ink/70 transition hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <BellIcon size={20} weight={unreadCount ? "fill" : "regular"} />
        {unreadCount !== null && unreadCount > 0 && (
          <span className="absolute right-0 top-0 min-w-4 rounded-full bg-rejected px-1 text-center text-[9px] font-bold leading-4 text-on-brand">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label={t("notifications.title")}
          className="fixed inset-x-3 top-16 z-[70] max-h-[min(calc(100dvh-5rem),42rem)] overflow-hidden rounded-xl border border-line bg-surface-elevated shadow-[var(--shadow-elevated)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-[28rem]"
        >
          <header className="flex items-center justify-between gap-4 border-b border-line bg-surface-card/75 px-5 py-4 backdrop-blur-xl">
            <div>
              <h2 className="text-lg font-bold text-ink">
                {t("notifications.title")}
              </h2>
              {unreadCount !== null && (
                <p className="mt-0.5 text-xs text-ink-faint">
                  {unreadCount > 0
                    ? `${unreadCount} ${t("notifications.unread")}`
                    : t("notifications.allRead")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={!unreadCount || markingAll}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-transparent px-3 py-2 text-xs font-semibold text-brand transition hover:border-brand/20 hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {markingAll ? (
                <CircleNotchIcon className="animate-spin" />
              ) : (
                <ChecksIcon />
              )}
              {t("notifications.markAll")}
            </button>
          </header>

          <div className="notification-scroll max-h-[calc(min(calc(100dvh-5rem),42rem)-5rem)] overflow-y-auto overscroll-contain">
            {loading ? (
              <div
                className="grid min-h-44 place-items-center"
                aria-label={t("notifications.loading")}
              >
                <CircleNotchIcon
                  className="animate-spin text-brand"
                  size={26}
                />
              </div>
            ) : error && notifications.length === 0 ? (
              <div className="px-5 py-10 text-center">
                <WarningCircleIcon
                  className="mx-auto text-rejected"
                  size={28}
                />
                <p role="alert" className="mt-3 text-sm text-rejected">
                  {error}
                </p>
                <button
                  type="button"
                  onClick={() => void refresh()}
                  className="mt-3 text-sm font-semibold text-brand hover:underline"
                >
                  {t("notifications.retry")}
                </button>
              </div>
            ) : notifications.length === 0 ? (
              <div className="px-5 py-12 text-center">
                <BellIcon className="mx-auto text-ink-faint" size={30} />
                <p className="mt-3 text-sm font-medium text-ink-muted">
                  {t("notifications.empty")}
                </p>
              </div>
            ) : (
              <>
                {error && (
                  <p
                    role="alert"
                    className="border-b border-line bg-rejected/10 px-4 py-2 text-xs text-rejected"
                  >
                    {error}
                  </p>
                )}
                <ul className="divide-y divide-line/80">
                  {notifications.map((notification) => {
                    const meta =
                      TYPE_META[notification.type] ?? TYPE_META.SYSTEM;
                    const Icon = meta.icon;
                    const marking = markingIds.has(notification.id);
                    const copy = notificationCopy(notification, t, locale);
                    return (
                      <li key={notification.id}>
                        <button
                          type="button"
                          onClick={() => void openNotification(notification)}
                          disabled={marking}
                          className={`group relative flex w-full items-start gap-3.5 border-l-2 px-4 py-3.5 text-left transition-[border-color,background-color] hover:bg-surface-hover disabled:opacity-60 ${
                            notification.isRead
                              ? "border-l-transparent bg-surface-elevated"
                              : "border-l-brand bg-brand/[0.06]"
                          }`}
                        >
                          <span
                            className={`grid size-10 shrink-0 place-items-center rounded-lg border border-current/10 ${meta.tone}`}
                          >
                            {marking ? (
                              <CircleNotchIcon className="animate-spin" />
                            ) : (
                              <Icon size={18} weight="duotone" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex items-center gap-2">
                              <span className="block min-w-0 flex-1 truncate text-sm font-bold text-ink">
                                {t(meta.titleKey)}
                              </span>
                              {!notification.isRead && (
                                <span
                                  className="size-2 shrink-0 rounded-full bg-brand shadow-[0_0_8px_color-mix(in_oklab,var(--color-brand)_55%,transparent)]"
                                  aria-label={t("notifications.unread")}
                                />
                              )}
                            </span>
                            <span
                              title={copy.message}
                              className="mt-1 block line-clamp-2 whitespace-normal break-words text-sm leading-5 text-ink-muted"
                            >
                              {copy.message}
                            </span>
                            {copy.detail && (
                              <span className="mt-1 block line-clamp-2 whitespace-normal break-words text-xs leading-4 text-ink-faint">
                                {copy.detail}
                              </span>
                            )}
                            <span className="mt-2 block truncate text-[11px] text-ink-faint">
                              {formatLocalizedDate(
                                notification.createdAt,
                                locale,
                                {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                },
                              )}
                              {notification.tournament
                                ? ` · ${notification.tournament.name}`
                                : ""}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                {pagination && pagination.page < pagination.totalPages && (
                  <div className="border-t border-line p-3 text-center">
                    <button
                      type="button"
                      onClick={() => void loadMore()}
                      disabled={loadingMore}
                      className="inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/10 disabled:opacity-60"
                    >
                      {loadingMore && (
                        <CircleNotchIcon className="animate-spin" />
                      )}
                      {t("notifications.loadMore")}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default function NotificationCenter() {
  const { user, ready } = useAuth();
  if (!ready || !user) return null;
  return <AuthenticatedNotificationCenter key={user.id} />;
}
