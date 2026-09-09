"use client";

import { useId, useState } from "react";
import { GraphIcon, ListBulletsIcon } from "@phosphor-icons/react";
import type {
  BracketMatch,
  RoundBracket,
  RoundStandings,
} from "@/features/tournaments/types";
import { useLocale } from "@/features/locale/store";
import BracketDiagram from "../competition/bracket/BracketDiagram";
import RoundMatchList from "./RoundMatchList";
import LeagueCompetitionView from "../competition/LeagueCompetitionView";

type ViewMode = "diagram" | "list";

export default function RoundCompetitionView({
  bracket,
  bannerUrl,
  tournamentName,
  standings,
  onSelectMatch,
  diagramClassName,
}: {
  bracket: RoundBracket;
  bannerUrl?: string | null;
  tournamentName?: string;
  standings?: RoundStandings;
  onSelectMatch?: (match: BracketMatch) => void;
  diagramClassName?: string;
}) {
  const { t } = useLocale();
  const panelId = useId();
  const [preferences, setPreferences] = useState<Record<string, ViewMode>>({});
  const mode =
    preferences[bracket.round.id] ??
    (["PLAYOFF", "DOUBLE_ELIM", "SWISS"].includes(bracket.round.format)
      ? "diagram"
      : "list");
  if (["GROUP_STAGE", "ROUND_ROBIN"].includes(bracket.round.format))
    return (
      <div className={diagramClassName}>
        <LeagueCompetitionView
          key={bracket.round.id}
          bracket={bracket}
          standings={standings}
          bannerUrl={bannerUrl}
          tournamentName={tournamentName}
          onSelectMatch={onSelectMatch}
        />
      </div>
    );
  return (
    <div className="min-w-0">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-ink-muted">{t("bracket.viewHint")}</p>
        <div
          className="inline-flex shrink-0 rounded-lg border border-line bg-surface-sub p-1"
          role="group"
          aria-label={t("bracket.viewMode")}
        >
          {(["diagram", "list"] as const).map((value) => {
            const Icon = value === "diagram" ? GraphIcon : ListBulletsIcon;
            return (
              <button
                key={value}
                type="button"
                aria-pressed={mode === value}
                aria-controls={panelId}
                onClick={() =>
                  setPreferences((current) => ({
                    ...current,
                    [bracket.round.id]: value,
                  }))
                }
                className={`inline-flex min-h-9 items-center gap-2 rounded-md px-3 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${mode === value ? "bg-surface-card text-brand shadow-sm" : "text-ink-muted hover:text-ink"}`}
              >
                <Icon size={16} />
                {t(value === "diagram" ? "bracket.diagram" : "bracket.list")}
              </button>
            );
          })}
        </div>
      </div>
      <div
        id={panelId}
        className={mode === "diagram" ? diagramClassName : undefined}
      >
        {mode === "diagram" ? (
          <BracketDiagram
            key={bracket.round.id}
            bracket={bracket}
            bannerUrl={bannerUrl}
            tournamentName={tournamentName}
            standings={standings}
            onSelectMatch={onSelectMatch}
          />
        ) : (
          <RoundMatchList bracket={bracket} onSelectMatch={onSelectMatch} />
        )}
      </div>
    </div>
  );
}
