"use client";

import { useEffect } from "react";
import {
  ArrowCounterClockwiseIcon,
  CircleNotchIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { secondaryButtonClass } from "@/components/ui";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import type { DownstreamResetPreview } from "@/features/tournaments/types";

const destructiveButtonClass =
  "inline-flex min-h-[var(--control-height)] items-center justify-center gap-2 rounded-[var(--radius-control)] bg-rejected px-5 py-3 text-sm font-semibold text-white transition hover:brightness-110 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50";

export default function DownstreamResetDialog({
  preview,
  isResetting,
  onClose,
  onConfirm,
}: {
  preview: DownstreamResetPreview;
  isResetting: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const { t } = useLocale();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isResetting) onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isResetting, onClose]);

  const metrics = [
    ["competition.reset.rounds", preview.impact.roundCount],
    ["competition.reset.matches", preview.impact.matchCount],
    [
      "competition.reset.progressedMatches",
      preview.impact.progressedMatchCount,
    ],
    [
      "competition.reset.participantAssignments",
      preview.impact.participantAssignmentCount,
    ],
  ] as const;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm sm:p-6"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isResetting) onClose();
      }}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="downstream-reset-title"
        className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-rejected/40 bg-surface-card shadow-2xl"
      >
        <header className="flex items-start justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-rejected">
              {t("competition.reset.eyebrow")}
            </p>
            <h3
              id="downstream-reset-title"
              className="mt-1 text-xl font-bold text-ink"
            >
              {t("competition.reset.title")}
            </h3>
            <p className="mt-2 text-sm text-ink-muted">
              {t("competition.reset.afterRound")} {preview.sourceRound.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            aria-label={t("common.close")}
            className="rounded-lg border border-line p-2 text-ink-muted transition hover:text-ink disabled:opacity-50"
          >
            <XIcon size={20} />
          </button>
        </header>

        <div className="space-y-5 px-4 py-5 sm:px-6">
          <div className="flex items-start gap-3 rounded-xl border border-rejected/35 bg-rejected/10 px-4 py-3 text-sm text-rejected">
            <WarningCircleIcon className="mt-0.5 shrink-0" size={20} />
            <p>{t("competition.reset.warning")}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {metrics.map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl border border-line bg-surface-sub p-3"
              >
                <dt className="text-xs text-ink-faint">
                  {t(label as TranslationKey)}
                </dt>
                <dd className="mt-1 text-xl font-bold text-ink">{value}</dd>
              </div>
            ))}
          </dl>

          <div>
            <h4 className="text-sm font-semibold text-ink">
              {t("competition.reset.affectedRounds")}
            </h4>
            <ul className="mt-2 space-y-2">
              {preview.downstreamRounds.map((round) => (
                <li
                  key={round.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-3 py-2.5 text-sm"
                >
                  <span className="font-medium text-ink">{round.name}</span>
                  <span className="text-xs text-ink-muted">
                    {round.matchCount} {t("competition.reset.matches")} ·{" "}
                    {round.participantAssignmentCount}{" "}
                    {t("competition.reset.participantAssignments")}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-4 sm:px-6">
          <button
            type="button"
            onClick={onClose}
            disabled={isResetting}
            className={secondaryButtonClass}
          >
            {t("common.cancel")}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isResetting}
            className={destructiveButtonClass}
          >
            {isResetting ? (
              <CircleNotchIcon className="animate-spin" />
            ) : (
              <ArrowCounterClockwiseIcon weight="bold" />
            )}
            {t("competition.reset.confirm")}
          </button>
        </footer>
      </section>
    </div>
  );
}
