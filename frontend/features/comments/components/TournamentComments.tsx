"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChatCircleDotsIcon } from "@phosphor-icons/react";
import { alertErrorClass, secondaryButtonClass } from "@/components/ui";
import { clearSession, useAuth } from "@/features/auth/store";
import { commentsApi } from "@/features/comments/api";
import CommentComposer from "@/features/comments/components/CommentComposer";
import CommentThread from "@/features/comments/components/CommentThread";
import type {
  CommentReplyTarget,
  TournamentComment,
  TournamentCommentThread,
} from "@/features/comments/types";
import { useLocale } from "@/features/locale/store";
import { useTournamentRealtime } from "@/features/realtime/provider";
import { ApiError } from "@/lib/api/client";

const PAGE_SIZE = 20;

function isTournamentComment(value: unknown): value is TournamentComment {
  if (typeof value !== "object" || value === null) return false;
  const comment = value as Record<string, unknown>;
  return (
    typeof comment.id === "string" &&
    typeof comment.content === "string" &&
    typeof comment.tournamentId === "string" &&
    typeof comment.createdAt === "string" &&
    (typeof comment.parentId === "string" || comment.parentId === null) &&
    typeof comment.author === "object" &&
    comment.author !== null
  );
}

function sortRoots(threads: TournamentCommentThread[]) {
  return [...threads].sort(
    (left, right) =>
      Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
      left.id.localeCompare(right.id),
  );
}

function sortReplies(replies: TournamentComment[]) {
  return [...replies].sort(
    (left, right) =>
      Date.parse(left.createdAt) - Date.parse(right.createdAt) ||
      left.id.localeCompare(right.id),
  );
}

function mergeReplies(
  current: TournamentComment[],
  incoming: TournamentComment[],
) {
  const byId = new Map(current.map((comment) => [comment.id, comment]));
  incoming.forEach((comment) => byId.set(comment.id, comment));
  return sortReplies([...byId.values()]);
}

export default function TournamentComments({
  slug,
  tournamentId,
  organizerId,
}: {
  slug: string;
  tournamentId: string;
  organizerId?: string;
}) {
  const { user } = useAuth();
  const { t } = useLocale();
  const [threads, setThreads] = useState<TournamentCommentThread[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [discussionTotal, setDiscussionTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const [activeReplyTarget, setActiveReplyTarget] =
    useState<CommentReplyTarget | null>(null);
  const [expandedThreadIds, setExpandedThreadIds] = useState<Set<string>>(
    new Set(),
  );
  const [workingComment, setWorkingComment] = useState<{
    id: string;
    action: "DELETE" | "HIDE";
  } | null>(null);
  const commentIdsRef = useRef(new Set<string>());
  const discussionTotalRef = useRef(0);
  const rootTotalRef = useRef(0);

  const updateDiscussionTotal = useCallback((nextTotal: number) => {
    const normalized = Math.max(0, nextTotal);
    discussionTotalRef.current = normalized;
    setDiscussionTotal(normalized);
  }, []);

  const updateRootTotal = useCallback((nextTotal: number) => {
    const normalized = Math.max(0, nextTotal);
    rootTotalRef.current = normalized;
    setTotalPages(Math.max(1, Math.ceil(normalized / PAGE_SIZE)));
  }, []);

  const storeThreads = useCallback((incoming: TournamentCommentThread[]) => {
    incoming.forEach((thread) => {
      commentIdsRef.current.add(thread.id);
      thread.replies.forEach((reply) => commentIdsRef.current.add(reply.id));
    });
    setThreads((current) => {
      const byId = new Map(current.map((thread) => [thread.id, thread]));
      incoming.forEach((thread) => {
        const existing = byId.get(thread.id);
        const replies = mergeReplies(existing?.replies ?? [], thread.replies);
        byId.set(thread.id, {
          ...existing,
          ...thread,
          replies,
          replyCount: replies.length,
        });
      });
      return sortRoots([...byId.values()]);
    });
  }, []);

  const upsertComment = useCallback((comment: TournamentComment) => {
    commentIdsRef.current.add(comment.id);
    setThreads((current) => {
      if (comment.parentId) {
        return current.map((thread) => {
          if (thread.id !== comment.parentId) return thread;
          const replies = mergeReplies(thread.replies, [comment]);
          return { ...thread, replies, replyCount: replies.length };
        });
      }

      const existing = current.find((thread) => thread.id === comment.id);
      const thread: TournamentCommentThread = {
        ...existing,
        ...comment,
        replies: existing?.replies ?? [],
        replyCount: existing?.replyCount ?? 0,
      };
      return sortRoots([
        ...current.filter((item) => item.id !== comment.id),
        thread,
      ]);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    commentsApi
      .findByTournament(slug, 1, PAGE_SIZE)
      .then((result) => {
        if (cancelled) return;
        storeThreads(result.data);
        setPage(result.pagination.page);
        updateRootTotal(
          Math.max(result.pagination.total, rootTotalRef.current),
        );
        updateDiscussionTotal(
          Math.max(result.discussionTotal, discussionTotalRef.current),
        );
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        if (reason instanceof ApiError && reason.status === 401) clearSession();
        setLoadError(
          reason instanceof Error ? reason.message : t("comments.loadError"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    reloadKey,
    slug,
    storeThreads,
    t,
    updateDiscussionTotal,
    updateRootTotal,
  ]);

  const retryFirstPage = () => {
    setLoading(true);
    setLoadError("");
    setReloadKey((current) => current + 1);
  };

  useTournamentRealtime(tournamentId, (event, payload) => {
    if (
      event !== "newComment" ||
      !isTournamentComment(payload) ||
      payload.tournamentId !== tournamentId
    ) {
      return;
    }
    const isNew = !commentIdsRef.current.has(payload.id);
    upsertComment(payload);
    if (isNew) {
      updateDiscussionTotal(discussionTotalRef.current + 1);
      if (!payload.parentId) updateRootTotal(rootTotalRef.current + 1);
    }
  });

  const createComment = async (content: string, replyToCommentId?: string) => {
    try {
      const created = await commentsApi.create(slug, content, replyToCommentId);
      const isNew = !commentIdsRef.current.has(created.id);
      upsertComment(created);
      if (isNew) {
        updateDiscussionTotal(discussionTotalRef.current + 1);
        if (created.parentId) {
          setExpandedThreadIds((current) =>
            new Set(current).add(created.parentId!),
          );
        } else {
          updateRootTotal(rootTotalRef.current + 1);
        }
      }
      setActiveReplyTarget(null);
      setActionError("");
      setNotice(
        created.parentId ? t("comments.replyPosted") : t("comments.posted"),
      );
      return true;
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) clearSession();
      throw reason;
    }
  };

  const loadMore = async () => {
    if (loadingMore || page >= totalPages) return;
    setLoadingMore(true);
    setLoadError("");
    try {
      const result = await commentsApi.findByTournament(
        slug,
        page + 1,
        PAGE_SIZE,
      );
      storeThreads(result.data);
      setPage(result.pagination.page);
      updateRootTotal(result.pagination.total);
      updateDiscussionTotal(
        Math.max(result.discussionTotal, discussionTotalRef.current),
      );
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) clearSession();
      setLoadError(
        reason instanceof Error ? reason.message : t("comments.loadError"),
      );
    } finally {
      setLoadingMore(false);
    }
  };

  const deleteComment = async (comment: TournamentComment) => {
    if (!window.confirm(t("comments.deleteConfirm"))) return;
    setWorkingComment({ id: comment.id, action: "DELETE" });
    setActionError("");
    setNotice("");
    try {
      const result = await commentsApi.remove(comment.id);
      if (result.tombstoned && result.comment) {
        upsertComment(result.comment);
      } else if (comment.parentId) {
        commentIdsRef.current.delete(comment.id);
        setThreads((current) =>
          current.map((thread) => {
            if (thread.id !== comment.parentId) return thread;
            const replies = thread.replies.filter(
              (reply) => reply.id !== comment.id,
            );
            return { ...thread, replies, replyCount: replies.length };
          }),
        );
        updateDiscussionTotal(discussionTotalRef.current - 1);
      } else {
        commentIdsRef.current.delete(comment.id);
        setThreads((current) =>
          current.filter((thread) => thread.id !== comment.id),
        );
        updateDiscussionTotal(discussionTotalRef.current - 1);
        updateRootTotal(rootTotalRef.current - 1);
      }
      if (activeReplyTarget?.commentId === comment.id) {
        setActiveReplyTarget(null);
      }
      setNotice(t("comments.deleted"));
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) clearSession();
      setActionError(
        reason instanceof Error ? reason.message : t("comments.deleteError"),
      );
    } finally {
      setWorkingComment(null);
    }
  };

  const hideComment = async (comment: TournamentComment) => {
    if (!window.confirm(t("comments.hideConfirm"))) return;
    setWorkingComment({ id: comment.id, action: "HIDE" });
    setActionError("");
    setNotice("");
    try {
      const hidden = await commentsApi.hide(comment.id);
      upsertComment(hidden);
      if (activeReplyTarget?.commentId === comment.id) {
        setActiveReplyTarget(null);
      }
      setNotice(t("comments.hidden"));
    } catch (reason) {
      if (reason instanceof ApiError && reason.status === 401) clearSession();
      setActionError(
        reason instanceof Error ? reason.message : t("comments.hideError"),
      );
    } finally {
      setWorkingComment(null);
    }
  };

  const toggleThread = useCallback((threadId: string) => {
    setExpandedThreadIds((current) => {
      const next = new Set(current);
      if (next.has(threadId)) next.delete(threadId);
      else next.add(threadId);
      return next;
    });
  }, []);

  return (
    <section
      id="comments"
      aria-labelledby="comments-title"
      className="mt-8 scroll-mt-28 bg-surface-card/65 px-4 py-7 sm:px-7 sm:py-8"
    >
      <h2
        id="comments-title"
        className="text-xl font-black text-ink sm:text-2xl"
      >
        {loading
          ? t("comments.title")
          : `${discussionTotal} ${t(
              discussionTotal === 1
                ? "comments.countUnitSingle"
                : "comments.countUnit",
            )}`}
      </h2>

      {user ? (
        <CommentComposer user={user} onSubmit={createComment} />
      ) : (
        <div className="mt-7 flex items-center gap-3 border-b border-line pb-5 text-sm text-ink-muted">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-surface-sub text-ink-faint">
            <ChatCircleDotsIcon size={21} aria-hidden />
          </span>
          <Link
            href="/login"
            className="font-semibold text-accent hover:underline"
          >
            {t("comments.signIn")}
          </Link>
        </div>
      )}

      {notice && (
        <p role="status" className="mt-4 text-sm font-semibold text-approved">
          {notice}
        </p>
      )}
      {actionError && (
        <p role="alert" className={`${alertErrorClass} mt-4`}>
          {actionError}
        </p>
      )}

      {loading ? (
        <div aria-label={t("comments.loading")} className="mt-8 space-y-8">
          {[0, 1, 2].map((item) => (
            <div key={item} className="flex animate-pulse gap-4">
              <div className="size-10 shrink-0 rounded-full bg-surface-sub" />
              <div className="flex-1 space-y-3">
                <div className="h-4 w-36 rounded bg-surface-sub" />
                <div className="h-3 w-24 rounded bg-surface-sub" />
                <div className="h-4 w-full rounded bg-surface-sub" />
              </div>
            </div>
          ))}
        </div>
      ) : loadError && threads.length === 0 ? (
        <div className="mt-6">
          <p role="alert" className={alertErrorClass}>
            {loadError}
          </p>
          <button
            type="button"
            onClick={retryFirstPage}
            className={`${secondaryButtonClass} mt-3`}
          >
            {t("common.retry")}
          </button>
        </div>
      ) : threads.length === 0 ? (
        <div className="mt-6 border border-dashed border-line px-4 py-12 text-center">
          <ChatCircleDotsIcon
            size={34}
            weight="duotone"
            className="mx-auto text-ink-faint"
          />
          <p className="mt-3 font-semibold text-ink">{t("comments.empty")}</p>
          <p className="mt-1 text-sm text-ink-muted">
            {t("comments.emptyHelp")}
          </p>
        </div>
      ) : (
        <>
          <ul className="mt-6 space-y-5">
            {threads.map((thread) => (
              <CommentThread
                key={thread.id}
                thread={thread}
                user={user}
                organizerId={organizerId}
                expanded={expandedThreadIds.has(thread.id)}
                activeReplyTarget={activeReplyTarget}
                workingComment={workingComment}
                onToggle={() => toggleThread(thread.id)}
                onStartReply={(target) => {
                  setActiveReplyTarget(target);
                  setExpandedThreadIds((current) =>
                    new Set(current).add(thread.id),
                  );
                }}
                onCancelReply={() => setActiveReplyTarget(null)}
                onCreateReply={(content, targetCommentId) =>
                  createComment(content, targetCommentId)
                }
                onDelete={deleteComment}
                onHide={hideComment}
              />
            ))}
          </ul>
          {loadError && (
            <p role="alert" className={`${alertErrorClass} mt-4`}>
              {loadError}
            </p>
          )}
          {page < totalPages && (
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={loadMore}
                disabled={loadingMore}
                className={secondaryButtonClass}
              >
                {loadingMore
                  ? t("comments.loadingMore")
                  : t("comments.loadMore")}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
