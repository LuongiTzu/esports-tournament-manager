"use client";

import { useEffect } from "react";
import {
  CircleNotchIcon,
  PlayIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { primaryButtonClass, secondaryButtonClass } from "@/components/ui";
import { useLocale } from "@/features/locale/store";
import type { RoundGenerationPreview } from "@/features/tournaments/types";
import RoundCompetitionView from "./RoundCompetitionView";

export default function RoundGenerationPreviewDialog({
  preview,
  isGenerating,
  onClose,
  onConfirm,
}: {
  preview: RoundGenerationPreview;
  isGenerating: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isGenerating) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isGenerating, onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isGenerating) onClose();
      }}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="round-preview-title"
        className="flex max-h-[92vh] w-full max-w-7xl flex-col overflow-hidden rounded-2xl border border-line bg-surface-card shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
              {t("competition.preview.eyebrow")}
            </p>
            <h3
              id="round-preview-title"
              className="mt-1 text-xl font-bold text-ink"
            >
              {t("competition.preview.title")}: {preview.bracket.round.name}
            </h3>
            <p className="mt-2 text-sm text-ink-muted">
              {preview.participantCount} {t("competition.preview.participants")}{" "}
              · {preview.matchCount} {t("competition.preview.matches")}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            aria-label={t("common.close")}
            className="rounded-lg border border-line p-2 text-ink-muted transition hover:border-line-strong hover:text-ink disabled:opacity-50"
          >
            <XIcon size={20} />
          </button>
        </header>

        {preview.force && (
          <div className="mx-4 mt-4 flex items-start gap-2 rounded-xl border border-pending/35 bg-pending/10 px-4 py-3 text-sm text-pending sm:mx-6">
            <WarningCircleIcon className="mt-0.5 shrink-0" />
            <span>{t("competition.preview.regenerationWarning")}</span>
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-auto px-4 py-5 sm:px-6">
          <RoundCompetitionView bracket={preview.bracket} />
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isGenerating}
            className={secondaryButtonClass}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isGenerating}
            className={primaryButtonClass}
          >
            {isGenerating ? (
              <CircleNotchIcon className="animate-spin" />
            ) : (
              <PlayIcon weight="fill" />
            )}
            {preview.force
              ? t("competition.preview.confirmRegenerate")
              : t("competition.preview.confirmGenerate")}
          </button>
        </footer>
      </section>
    </div>
  );
}
