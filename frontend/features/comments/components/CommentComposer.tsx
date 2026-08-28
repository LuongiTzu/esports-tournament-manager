"use client";

import {
  useId,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";
import { SmileyIcon } from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { alertErrorClass } from "@/components/ui";
import type { User } from "@/features/auth/types";
import { useLocale } from "@/features/locale/store";

const MAX_COMMENT_LENGTH = 1000;
const COMMENT_EMOJIS = [
  "😀",
  "😃",
  "😄",
  "😁",
  "😆",
  "😅",
  "😂",
  "🤣",
  "😊",
  "😇",
  "🙂",
  "🙃",
  "😉",
  "😌",
  "😍",
  "🥰",
  "😘",
  "😋",
  "😎",
  "🤩",
  "🥳",
  "😏",
  "😒",
  "😔",
  "😢",
  "😭",
  "😤",
  "😡",
  "🤯",
  "😱",
  "😴",
  "🤔",
  "🤭",
  "🫡",
  "🤝",
  "🙏",
  "💪",
  "👌",
  "✌️",
  "🤞",
  "🤟",
  "🤘",
  "🔥",
  "👏",
  "🎉",
  "✨",
  "💯",
  "💥",
  "⭐",
  "🏆",
  "🥇",
  "🎮",
  "🕹️",
  "⚔️",
  "🛡️",
  "🚀",
  "💡",
  "❤️",
  "🧡",
  "💛",
  "💚",
  "💙",
  "💜",
  "🖤",
  "🤍",
  "💔",
  "👍",
  "👎",
  "🙌",
  "👀",
  "😮",
  "✅",
  "❌",
  "⚠️",
];

export default function CommentComposer({
  user,
  onSubmit,
  replyingTo,
  onCancel,
}: {
  user: User;
  onSubmit: (content: string) => Promise<boolean>;
  replyingTo?: string;
  onCancel?: () => void;
}) {
  const { t } = useLocale();
  const inputId = useId();
  const [content, setContent] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiMenuRef = useRef<HTMLDetailsElement>(null);
  const submittingRef = useRef(false);
  const trimmedContent = content.trim();
  const canSubmit =
    !submitting &&
    trimmedContent.length > 0 &&
    trimmedContent.length <= MAX_COMMENT_LENGTH;

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canSubmit || submittingRef.current) return;
    submittingRef.current = true;
    setSubmitting(true);
    setError("");
    try {
      const created = await onSubmit(trimmedContent);
      if (created) {
        setContent("");
        if (textareaRef.current) textareaRef.current.style.height = "auto";
        textareaRef.current?.focus();
      }
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : t(replyingTo ? "comments.replyError" : "comments.postError"),
      );
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  };

  const changeContent = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setContent(event.target.value);
    event.target.style.height = "auto";
    event.target.style.height = `${Math.min(event.target.scrollHeight, 160)}px`;
    event.target.style.overflowY =
      event.target.scrollHeight > 160 ? "auto" : "hidden";
  };

  const cancel = () => {
    setContent("");
    setError("");
    setFocused(false);
    if (textareaRef.current) textareaRef.current.style.height = "auto";
    textareaRef.current?.blur();
    onCancel?.();
  };

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const selectionStart = textarea.selectionStart;
    const selectionEnd = textarea.selectionEnd;
    const nextContent =
      content.slice(0, selectionStart) + emoji + content.slice(selectionEnd);
    if (nextContent.length > MAX_COMMENT_LENGTH) return;

    setContent(nextContent);
    emojiMenuRef.current?.removeAttribute("open");
    requestAnimationFrame(() => {
      const nextCursorPosition = selectionStart + emoji.length;
      textarea.focus();
      textarea.setSelectionRange(nextCursorPosition, nextCursorPosition);
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
    });
  };

  return (
    <form
      onSubmit={submit}
      className={`${replyingTo ? "mt-4" : "mt-7"} flex items-start gap-3 sm:gap-4`}
    >
      <span className="grid size-10 shrink-0 place-items-center overflow-hidden rounded-full bg-accent font-bold text-on-accent">
        <ResolvedImage
          src={user.avatarUrl}
          alt=""
          className="size-full object-cover object-center"
          fallback={user.displayName.charAt(0).toUpperCase()}
        />
      </span>
      <div className="min-w-0 flex-1">
        {replyingTo && (
          <p className="mb-1 text-xs text-ink-muted">
            {t("comments.replyingTo")}{" "}
            <span className="font-bold text-accent">@{replyingTo}</span>
          </p>
        )}
        <label htmlFor={inputId} className="sr-only">
          {t("comments.write")}
        </label>
        <textarea
          ref={textareaRef}
          id={inputId}
          value={content}
          onChange={changeContent}
          onFocus={() => setFocused(true)}
          autoFocus={Boolean(replyingTo)}
          maxLength={MAX_COMMENT_LENGTH}
          rows={1}
          placeholder={
            replyingTo
              ? t("comments.replyPlaceholder")
              : t("comments.placeholder")
          }
          disabled={submitting}
          className="min-h-9 w-full resize-none overflow-hidden border-x-0 border-b-2 border-t-0 border-line bg-transparent px-0 py-1.5 text-sm leading-6 text-ink outline-none transition placeholder:text-ink-faint hover:border-line-strong focus:border-accent disabled:opacity-60"
        />
        <div className="mt-2 flex min-h-10 flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <details ref={emojiMenuRef} className="relative">
              <summary
                className="grid size-9 cursor-pointer list-none place-items-center rounded-full text-ink-muted transition hover:bg-surface-hover hover:text-ink focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)] [&::-webkit-details-marker]:hidden"
                aria-label={t("comments.emojiPicker")}
                aria-haspopup="menu"
              >
                <SmileyIcon size={24} />
              </summary>
              <div
                role="menu"
                className="absolute bottom-11 left-0 z-20 grid max-h-56 w-72 grid-cols-8 gap-1 overflow-y-auto rounded-[var(--radius-control)] border border-line bg-surface-card p-2 shadow-[var(--shadow-elevated)]"
              >
                {COMMENT_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    role="menuitem"
                    onClick={() => insertEmoji(emoji)}
                    aria-label={`${t("comments.insertEmoji")} ${emoji}`}
                    className="grid size-8 place-items-center rounded text-lg transition hover:bg-surface-hover focus-visible:outline-none focus-visible:shadow-[var(--shadow-focus)]"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </details>
            <span
              className="text-xs tabular-nums text-ink-faint"
              aria-label={`${content.length} / ${MAX_COMMENT_LENGTH} ${t("comments.characters")}`}
            >
              {content.length} / {MAX_COMMENT_LENGTH}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {(focused || content.length > 0) && (
              <button
                type="button"
                onClick={cancel}
                disabled={submitting}
                className="min-h-10 rounded-full px-4 text-sm font-bold text-ink transition hover:bg-surface-hover disabled:opacity-50"
              >
                {t("comments.cancel")}
              </button>
            )}
            <button
              type="submit"
              disabled={!canSubmit}
              className="min-h-10 rounded-full bg-accent px-5 text-sm font-bold text-on-accent transition hover:brightness-110 disabled:bg-surface-sub disabled:text-ink-faint disabled:opacity-100"
            >
              {submitting
                ? t("comments.posting")
                : replyingTo
                  ? t("comments.reply")
                  : t("comments.post")}
            </button>
          </div>
        </div>
        {error && (
          <p role="alert" className={`${alertErrorClass} mt-3`}>
            {error}
          </p>
        )}
      </div>
    </form>
  );
}
