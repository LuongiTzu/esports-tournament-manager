"use client";

import { EyeSlashIcon, UserCircleIcon } from "@phosphor-icons/react";
import type { AdminComment } from "@/features/admin/types";
import { useLocale } from "@/features/locale/store";

export default function AdminCommentList({
  comments,
  selectedId,
  onSelect,
}: {
  comments: AdminComment[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useLocale();
  return (
    <div className="divide-y divide-line overflow-hidden rounded-xl border border-line">
      {comments.map((comment) => (
        <button
          key={comment.id}
          type="button"
          onClick={() => onSelect(comment.id)}
          aria-pressed={comment.id === selectedId}
          className={`block w-full px-4 py-3 text-left transition ${comment.id === selectedId ? "bg-brand/10" : "hover:bg-surface-hover"}`}
        >
          <span className="flex items-start justify-between gap-3">
            <span className="min-w-0">
              <span className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted">
                <UserCircleIcon /> {comment.author.displayName}
              </span>
              <span className="mt-1 line-clamp-2 break-words text-sm leading-5 text-ink">
                {comment.content}
              </span>
              <span className="mt-1 block truncate text-xs text-ink-faint">
                {comment.tournament.name}
              </span>
            </span>
            {comment.isHidden && (
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-rejected/12 px-2 py-1 text-[11px] font-semibold text-rejected">
                <EyeSlashIcon weight="fill" /> {t("admin.comments.hidden")}
              </span>
            )}
          </span>
        </button>
      ))}
    </div>
  );
}
