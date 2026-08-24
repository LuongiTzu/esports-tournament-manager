"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BellIcon,
  CalendarDotsIcon,
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
  ADMIN_WARNING: {
    titleKey: "notifications.type.adminWarning",
    icon: ShieldWarningIcon,
    tone: "bg-pending/10 text-pending",
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

function AuthenticatedNotificationCenter() {
  const router = useRouter();
  const { locale, t } = useLocale();
  const rootRef = useRef<HTMLDivElement>(null);
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
      if (!silent) setLoading(true);
      setError("");
      try {
        const [list, unread] = await Promise.all([
          notificationsApi.findMine({ page: 1, limit: PAGE_SIZE }),
          notificationsApi.unreadCount(),
        ]);
        setNotifications(list.data);
        setPagination(list.pagination);
        setUnreadCount(unread.count);
      } catch (reason) {
        setError(
          reason instanceof Error
            ? reason.message
            : t("notifications.loadError"),
        );
      } finally {
        setLoading(false);
      }
    },
    [t],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => void refresh(), 0);
    return () => window.clearTimeout(timer);
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
    try {
      const next = await notificationsApi.findMine({
        page: pagination.page + 1,
        limit: pagination.limit,
      });
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
    if (notification.tournament?.slug) {
      setOpen(false);
      router.push(`/tournaments/${notification.tournament.slug}`);
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
        className="relative grid size-10 place-items-center rounded-lg border border-line bg-surface/55 text-ink-muted transition hover:border-brand/50 hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand"
      >
        <BellIcon size={20} weight={unreadCount ? "fill" : "regular"} />
        {unreadCount !== null && unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 min-w-5 rounded-full border-2 border-surface bg-rejected px-1 text-center text-[10px] font-bold leading-4 text-on-brand">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label={t("notifications.title")}
          className="fixed inset-x-4 top-20 z-[70] max-h-[min(70vh,38rem)] overflow-hidden rounded-2xl border border-line bg-surface-elevated shadow-[var(--shadow-elevated)] sm:absolute sm:inset-x-auto sm:right-0 sm:top-12 sm:w-96"
        >
          <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
            <div>
              <h2 className="font-bold text-ink">{t("notifications.title")}</h2>
              {unreadCount !== null && (
                <p className="mt-0.5 text-xs text-ink-faint">
                  {unreadCount} {t("notifications.unread")}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={!unreadCount || markingAll}
              className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-xs font-semibold text-brand transition hover:bg-brand/10 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {markingAll ? (
                <CircleNotchIcon className="animate-spin" />
              ) : (
                <ChecksIcon />
              )}
              {t("notifications.markAll")}
            </button>
          </header>

          <div className="max-h-[calc(min(70vh,38rem)-4.5rem)] overflow-y-auto">
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
                <ul className="divide-y divide-line">
                  {notifications.map((notification) => {
                    const meta = TYPE_META[notification.type];
                    const Icon = meta.icon;
                    const marking = markingIds.has(notification.id);
                    return (
                      <li key={notification.id}>
                        <button
                          type="button"
                          onClick={() => void openNotification(notification)}
                          disabled={marking}
                          className={`relative flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-surface-hover disabled:opacity-60 ${notification.isRead ? "bg-surface-elevated" : "bg-brand/5"}`}
                        >
                          {!notification.isRead && (
                            <span
                              className="absolute left-1.5 top-5 size-1.5 rounded-full bg-brand"
                              aria-label={t("notifications.unread")}
                            />
                          )}
                          <span
                            className={`grid size-9 shrink-0 place-items-center rounded-full ${meta.tone}`}
                          >
                            {marking ? (
                              <CircleNotchIcon className="animate-spin" />
                            ) : (
                              <Icon size={18} weight="duotone" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-sm font-semibold text-ink">
                              {t(meta.titleKey)}
                            </span>
                            <span className="mt-0.5 block whitespace-normal break-words text-sm leading-5 text-ink-muted">
                              {notification.content}
                            </span>
                            <span className="mt-1.5 block text-xs text-ink-faint">
                              {new Intl.DateTimeFormat(
                                locale === "vi" ? "vi-VN" : "en-US",
                                { dateStyle: "medium", timeStyle: "short" },
                              ).format(new Date(notification.createdAt))}
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
