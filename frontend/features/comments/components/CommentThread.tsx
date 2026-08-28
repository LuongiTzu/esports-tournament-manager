"use client";

import { useEffect, useRef } from "react";
import { CaretDownIcon, CaretUpIcon } from "@phosphor-icons/react";
import type { User } from "@/features/auth/types";
import CommentComposer from "@/features/comments/components/CommentComposer";
import CommentItem from "@/features/comments/components/CommentItem";
import type {
  CommentReplyTarget,
  TournamentComment,
  TournamentCommentThread,
} from "@/features/comments/types";
import { useLocale } from "@/features/locale/store";

export default function CommentThread({
  thread,
  user,
  organizerId,
  expanded,
  activeReplyTarget,
  workingComment,
  onToggle,
  onStartReply,
  onCancelReply,
  onCreateReply,
  onDelete,
  onHide,
}: {
  thread: TournamentCommentThread;
  user: User | null;
  organizerId?: string;
  expanded: boolean;
  activeReplyTarget: CommentReplyTarget | null;
  workingComment: { id: string; action: "DELETE" | "HIDE" } | null;
  onToggle: () => void;
  onStartReply: (target: CommentReplyTarget) => void;
  onCancelReply: () => void;
  onCreateReply: (content: string, targetCommentId: string) => Promise<boolean>;
  onDelete: (comment: TournamentComment) => void;
  onHide: (comment: TournamentComment) => void;
}) {
  const { t } = useLocale();
  const handledDeepLinkRef = useRef(false);
  const replyingInThread = activeReplyTarget?.rootId === thread.id;

  useEffect(() => {
    if (handledDeepLinkRef.current) return;
    if (window.location.hash !== `#comment-${thread.id}`) return;
    handledDeepLinkRef.current = true;
    if (!expanded && thread.replyCount > 0) onToggle();
    window.setTimeout(() => {
      document
        .getElementById(`comment-${thread.id}`)
        ?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  }, [expanded, onToggle, thread.id, thread.replyCount]);

  const startReply = (comment: TournamentComment) => {
    onStartReply({
      commentId: comment.id,
      rootId: thread.id,
      displayName: comment.author.displayName,
    });
  };

  return (
    <li>
      <CommentItem
        comment={thread}
        user={user}
        organizerId={organizerId}
        workingAction={
          workingComment?.id === thread.id ? workingComment.action : null
        }
        onDelete={() => onDelete(thread)}
        onHide={() => onHide(thread)}
        onReply={() => startReply(thread)}
      />

      {thread.replyCount > 0 && (
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="ml-12 mt-2 inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-bold text-accent transition hover:bg-accent/10 sm:ml-14"
        >
          {expanded ? <CaretUpIcon /> : <CaretDownIcon />}
          {expanded
            ? t("comments.hideReplies")
            : `${t("comments.viewReplies")} ${thread.replyCount} ${
                thread.replyCount === 1
                  ? t("comments.replyUnitSingle")
                  : t("comments.replyUnit")
              }`}
        </button>
      )}

      {expanded && thread.replies.length > 0 && (
        <ul className="ml-5 mt-3 space-y-4 border-l border-line pl-5 sm:ml-6 sm:pl-7">
          {thread.replies.map((reply) => (
            <li key={reply.id}>
              <CommentItem
                comment={reply}
                user={user}
                organizerId={organizerId}
                workingAction={
                  workingComment?.id === reply.id ? workingComment.action : null
                }
                onDelete={() => onDelete(reply)}
                onHide={() => onHide(reply)}
                onReply={() => startReply(reply)}
              />
            </li>
          ))}
        </ul>
      )}

      {user && replyingInThread && activeReplyTarget && (
        <div className="ml-5 border-l border-line pl-5 sm:ml-6 sm:pl-7">
          <CommentComposer
            user={user}
            replyingTo={activeReplyTarget.displayName}
            onCancel={onCancelReply}
            onSubmit={(content) =>
              onCreateReply(content, activeReplyTarget.commentId)
            }
          />
        </div>
      )}
    </li>
  );
}
