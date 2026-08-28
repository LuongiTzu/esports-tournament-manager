"use client";

import { useRef } from "react";
import { DotsThreeIcon, EyeSlashIcon, TrashIcon } from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import type { User } from "@/features/auth/types";
import type { TournamentComment } from "@/features/comments/types";
import { formatRelativeDate } from "@/features/locale/format";
import { useLocale } from "@/features/locale/store";

export default function CommentItem({
  comment,
  user,
  organizerId,
  workingAction,
  onDelete,
  onHide,
  onReply,
}: {
  comment: TournamentComment;
  user: User | null;
  organizerId?: string;
  workingAction: "DELETE" | "HIDE" | null;
  onDelete: () => void;
  onHide: () => void;
  onReply?: () => void;
}) {
  const { locale, t } = useLocale();
  const menuRef = useRef<HTMLDetailsElement>(null);
  const canModerate = Boolean(
    user && (user.role === "ADMIN" || user.id === organizerId),
  );
  const canDelete = Boolean(
    !comment.deletedAt &&
    user &&
    (canModerate || user.id === comment.author.id),
  );
  const canHide = canModerate && !comment.isHidden && !comment.deletedAt;
  const canReply = Boolean(
    user && onReply && !comment.isHidden && !comment.deletedAt,
  );
  const hasActions = canDelete || canHide;
  const closeAndRun = (action: () => void) => {
    menuRef.current?.removeAttribute("open");
    action();
  };

  return (
    <article
      id={`comment-${comment.id}`}
      className="flex min-w-0 gap-3 sm:gap-4"
    >
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-accent text-sm font-bold text-on-accent">
        <ResolvedImage
          src={comment.author.avatarUrl}
          alt=""
          className="size-full object-cover object-center"
          fallback={comment.author.displayName.charAt(0).toUpperCase()}
        />
      </span>
      <div className="relative min-w-0 flex-1">
        <div className="min-w-0 pr-10">
          <div className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <p className="truncate text-sm font-bold text-ink">
              {comment.author.displayName}
            </p>
            <time
              dateTime={comment.createdAt}
              className="shrink-0 text-xs text-ink-faint"
            >
              {formatRelativeDate(comment.createdAt, locale)}
            </time>
          </div>
          {hasActions && (
            <details ref={menuRef} className="absolute right-0 top-0">
              <summary
                className="grid size-9 cursor-pointer list-none place-items-center rounded-[var(--radius-control)] text-ink-muted transition hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] [&::-webkit-details-marker]:hidden"
                aria-label={t("comments.actions")}
                aria-haspopup="menu"
              >
                <DotsThreeIcon size={22} weight="bold" />
              </summary>
              <div
                role="menu"
                className="absolute right-0 top-10 z-10 min-w-44 rounded-[var(--radius-control)] border border-line bg-surface-card p-1.5 shadow-[var(--shadow-elevated)]"
              >
                {canHide && (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={workingAction !== null}
                    onClick={() => closeAndRun(onHide)}
                    className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-left text-sm text-ink-muted transition hover:bg-surface-hover hover:text-ink disabled:opacity-50"
                  >
                    <EyeSlashIcon size={17} />
                    {workingAction === "HIDE"
                      ? t("comments.hiding")
                      : t("comments.hide")}
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    role="menuitem"
                    disabled={workingAction !== null}
                    onClick={() => closeAndRun(onDelete)}
                    className="flex w-full items-center gap-2 rounded-[var(--radius-control)] px-3 py-2 text-left text-sm text-rejected transition hover:bg-rejected/10 disabled:opacity-50"
                  >
                    <TrashIcon size={17} />
                    {workingAction === "DELETE"
                      ? t("comments.deleting")
                      : t("comments.delete")}
                  </button>
                )}
              </div>
            </details>
          )}
        </div>

        {comment.deletedAt ? (
          <p className="mt-1 text-sm italic text-ink-faint">
            {t("comments.deletedTombstone")}
          </p>
        ) : comment.isHidden ? (
          <p className="mt-3 inline-flex items-center gap-2 border border-rejected/25 bg-rejected/8 px-3 py-2 text-xs font-semibold text-rejected">
            <EyeSlashIcon size={16} />
            {t("comments.hiddenByOrganizer")}
          </p>
        ) : null}
        {!comment.deletedAt && (
          <p
            className={`mt-1 whitespace-pre-wrap break-words text-sm leading-6 ${
              comment.isHidden ? "text-ink-faint" : "text-ink-muted"
            }`}
          >
            {comment.replyToUser && (
              <span className="mr-1 font-semibold text-accent">
                @{comment.replyToUser.displayName}
              </span>
            )}
            {comment.content}
          </p>
        )}
        {canReply && (
          <button
            type="button"
            onClick={onReply}
            className="mt-0.5 rounded-full px-2.5 py-1 text-xs font-bold text-ink-muted transition hover:bg-surface-hover hover:text-ink"
          >
            {t("comments.reply")}
          </button>
        )}
      </div>
    </article>
  );
}
