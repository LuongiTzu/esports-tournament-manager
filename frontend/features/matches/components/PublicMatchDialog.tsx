"use client";

import { useEffect, useId, useRef } from "react";
import { XIcon } from "@phosphor-icons/react";
import type { BracketMatch } from "@/features/tournaments/types";
import { useLocale } from "@/features/locale/store";
import { formatLocalizedDate } from "@/features/locale/format";
import YouTubePlayer from "./YouTubePlayer";

export default function PublicMatchDialog({
  match,
  onClose,
}: {
  match: BracketMatch;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const focused = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (focused instanceof HTMLElement) focused.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="fixed inset-0 m-auto max-h-[90dvh] w-[calc(100%-1rem)] max-w-[900px] overflow-y-auto rounded-2xl border border-line bg-surface-card p-4 text-ink shadow-2xl backdrop:bg-black/70 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id={id} className="text-lg font-bold">
          {t("match.viewDetails")} · {t("match.label")}{" "}
          {match.matchNumber ?? "—"}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className="grid size-10 shrink-0 place-items-center rounded-lg hover:bg-surface-sub"
        >
          <XIcon size={22} />
        </button>
      </div>
      <div className="my-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 text-center">
        <p className="break-words font-semibold">
          {match.slots.A?.name ?? t("match.awaitingTeam")}
        </p>
        <p className="font-mono text-2xl font-bold">
          {match.status === "PENDING"
            ? "VS"
            : `${match.score.A} – ${match.score.B}`}
        </p>
        <p className="break-words font-semibold">
          {match.slots.B?.name ?? t("match.awaitingTeam")}
        </p>
      </div>
      <p className="mb-5 text-center text-sm text-ink-muted">
        {t(`match.status.${match.status}`)} · BO{match.bestOf} ·{" "}
        {match.scheduledAt
          ? formatLocalizedDate(match.scheduledAt, locale, {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : t("match.manage.unscheduled")}
      </p>
      {match.youtubeUrl ? (
        <YouTubePlayer url={match.youtubeUrl} />
      ) : (
        <p className="rounded-xl border border-dashed border-line p-6 text-center text-ink-muted">
          {t("youtube.empty")}
        </p>
      )}
    </dialog>
  );
}
