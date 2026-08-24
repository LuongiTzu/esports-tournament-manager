"use client";

import { useEffect, useRef, useState } from "react";
import { EyeSlashIcon, XIcon } from "@phosphor-icons/react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { useLocale } from "@/features/locale/store";

export default function TournamentModerationDialog({
  tournamentName,
  open,
  working,
  onClose,
  onConfirm,
}: {
  tournamentName: string;
  open: boolean;
  working: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { t } = useLocale();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const trimmedReason = reason.trim();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const closeDialog = () => {
    setReason("");
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      onCancel={(event) => {
        event.preventDefault();
        if (!working) closeDialog();
      }}
      onClose={() => {
        if (open && !working) closeDialog();
      }}
      className="m-auto w-[min(92vw,32rem)] rounded-2xl border border-line bg-surface-elevated p-0 text-ink shadow-[var(--shadow-elevated)] backdrop:bg-overlay"
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmedReason.length >= 3 && trimmedReason.length <= 500) {
            onConfirm(trimmedReason);
          }
        }}
        className="p-5 sm:p-6"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="grid size-11 place-items-center rounded-xl bg-rejected/12 text-rejected">
              <EyeSlashIcon size={22} weight="duotone" />
            </span>
            <h2 className="mt-4 text-xl font-black">{t("admin.tournaments.hideTitle")}</h2>
          </div>
          <button
            type="button"
            aria-label={t("common.close")}
            disabled={working}
            onClick={closeDialog}
            className="grid size-10 place-items-center rounded-lg text-ink-muted hover:bg-surface-hover hover:text-ink"
          >
            <XIcon />
          </button>
        </div>
        <p className="mt-3 text-sm leading-6 text-ink-muted">
          “{tournamentName}” {t("admin.tournaments.hideDescriptionPrefix")}
        </p>
        <label className="mt-5 block">
          <span className="text-sm font-semibold text-ink">{t("admin.tournaments.moderationReason")}</span>
          <textarea
            autoFocus
            required
            minLength={3}
            maxLength={500}
            rows={4}
            value={reason}
            disabled={working}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t("admin.tournaments.reasonPlaceholder")}
            className="mt-2 w-full resize-y rounded-xl border border-line bg-input px-4 py-3 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand focus:shadow-[var(--shadow-focus)]"
          />
          <span className="mt-1 flex justify-between gap-3 text-xs text-ink-faint">
            <span>{t("admin.tournaments.reasonHint")}</span>
            <span>{reason.length}/500</span>
          </span>
        </label>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={working}
            onClick={closeDialog}
            className={secondaryButtonClass}
          >
            {t("common.cancel")}
          </button>
          <button
            type="submit"
            disabled={working || trimmedReason.length < 3 || trimmedReason.length > 500}
            className={`${primaryButtonClass} bg-rejected bg-none shadow-none`}
          >
            <EyeSlashIcon /> {working ? t("admin.tournaments.hiding") : t("admin.tournaments.confirmHide")}
          </button>
        </div>
      </form>
    </dialog>
  );
}
