"use client";

import { ArrowRightIcon, CheckIcon } from "@phosphor-icons/react";
import { useLocale } from "@/features/locale/store";
import { roundFormatLabel } from "@/features/tournaments/round-formats";
import type { TournamentRound } from "@/features/tournaments/types";

export default function CompetitionStageNavigation({
  rounds,
  selectedRoundId,
  onSelect,
}: {
  rounds: TournamentRound[];
  selectedRoundId?: string;
  onSelect: (id: string) => void;
}) {
  const { t } = useLocale();
  return (
    <nav
      aria-label={t("competition.roundNavigation")}
      className="mt-5 flex max-w-full items-stretch gap-2 overflow-x-auto pb-2"
    >
      {rounds.map((round, index) => (
        <div key={round.id} className="flex shrink-0 items-center gap-2">
          {index > 0 && (
            <ArrowRightIcon
              size={18}
              className="shrink-0 text-ink-faint"
              aria-hidden="true"
            />
          )}
          <button
            type="button"
            onClick={() => onSelect(round.id)}
            aria-current={round.id === selectedRoundId ? "step" : undefined}
            className={`flex min-h-24 w-56 items-start gap-3 rounded-xl border p-4 text-left transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${round.id === selectedRoundId ? "border-brand/60 bg-brand/10" : "border-line bg-surface-card hover:border-line-strong"}`}
          >
            <span
              className={`mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border text-xs font-bold ${round.status === "COMPLETED" ? "border-approved/30 bg-approved/10 text-approved" : round.id === selectedRoundId ? "border-brand/50 text-brand" : "border-line text-ink-faint"}`}
            >
              {round.status === "COMPLETED" ? (
                <CheckIcon weight="bold" size={14} />
              ) : (
                String(index + 1).padStart(2, "0")
              )}
            </span>
            <span className="min-w-0">
              <span className="block text-[9px] font-semibold uppercase tracking-wider text-ink-faint">
                {t("competition.stage")} {index + 1} ·{" "}
                {t(`round.status.${round.status}`)}
              </span>
              <span
                className="mt-1 block truncate text-sm font-bold text-ink"
                title={round.name}
              >
                {round.name}
              </span>
              <span className="mt-1 block text-xs text-ink-muted">
                {roundFormatLabel(round.format, t)}
              </span>
            </span>
          </button>
        </div>
      ))}
    </nav>
  );
}
