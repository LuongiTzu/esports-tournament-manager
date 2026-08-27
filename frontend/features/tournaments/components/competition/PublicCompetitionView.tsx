"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CircleNotchIcon,
  TrophyIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { alertErrorClass } from "@/components/ui";
import { tournamentsApi } from "@/features/tournaments/api";
import { roundFormatLabel } from "@/features/tournaments/round-formats";
import type {
  RoundBracket,
  RoundStandings,
  TournamentStandingsResponse,
} from "@/features/tournaments/types";
import RoundCompetitionView from "../manage/RoundCompetitionView";
import RoundProgressionSummary from "../manage/RoundProgressionSummary";
import RoundStandingsView from "../manage/RoundStandingsView";
import RoundSettingsSummary from "./RoundSettingsSummary";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { useCompetitionInvalidation } from "@/features/tournaments/realtime";

export default function PublicCompetitionView({
  id,
  slug,
  tournamentId,
}: {
  id?: string;
  slug: string;
  tournamentId: string;
}) {
  const { t } = useLocale();
  const [rounds, setRounds] = useState<RoundBracket[]>([]);
  const [standings, setStandings] =
    useState<TournamentStandingsResponse | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      tournamentsApi.getTournamentBracket(slug),
      tournamentsApi.getStandings(slug),
    ])
      .then(([bracketResponse, standingsResponse]) => {
        if (cancelled) return;
        const orderedRounds = [...bracketResponse.rounds].sort(
          (a, b) => a.round.orderIndex - b.round.orderIndex,
        );
        setRounds(orderedRounds);
        setStandings(standingsResponse);
        setSelectedRoundId((current) =>
          orderedRounds.some(({ round }) => round.id === current)
            ? current
            : (orderedRounds[0]?.round.id ?? ""),
        );
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error
            ? reason.message
            : t("competition.loadError"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refreshVersion, slug, t]);

  useCompetitionInvalidation(tournamentId, () => {
    setRefreshVersion((version) => version + 1);
  });

  const selectedBracket = useMemo(
    () => rounds.find(({ round }) => round.id === selectedRoundId) ?? rounds[0],
    [rounds, selectedRoundId],
  );
  const selectedStandings = standings?.rounds.find(
    (round): round is RoundStandings =>
      round.roundId === selectedBracket?.round.id,
  );

  return (
    <section
      id={id}
      aria-labelledby="public-competition-heading"
      className="mt-8 min-w-0 scroll-mt-28 overflow-hidden border border-line bg-surface-card/90 p-4 sm:p-7"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            {t("competition.eyebrow")}
          </p>
          <h2
            id="public-competition-heading"
            className="mt-1 text-xl font-bold text-ink sm:text-2xl"
          >
            {t("competition.title")}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            {t("competition.description")}
          </p>
        </div>
        {standings && (
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${
                standings.tournament.status === "COMPLETED"
                  ? "border-approved/30 bg-approved/10 text-approved"
                  : standings.tournament.status === "CANCELLED"
                    ? "border-rejected/30 bg-rejected/10 text-rejected"
                    : "border-line bg-surface-sub text-ink-muted"
              }`}
            >
              {t(`tournament.status.${standings.tournament.status}` as TranslationKey)}
            </span>
            {standings.tournament.champion && (
              <span className="inline-flex items-center gap-2 rounded-full border border-approved/30 bg-approved/10 px-3 py-1.5 text-sm font-semibold text-approved">
                <TrophyIcon weight="fill" />{" "}
                {standings.tournament.champion.name}
              </span>
            )}
          </div>
        )}
      </div>

      {loading ? (
        <div
          className="grid min-h-52 place-items-center"
          aria-label={t("competition.loading")}
        >
          <CircleNotchIcon className="animate-spin text-brand" size={28} />
        </div>
      ) : error ? (
        <p
          role="alert"
          className={`${alertErrorClass} mt-5 flex items-start gap-2`}
        >
          <WarningCircleIcon className="mt-0.5 shrink-0" /> {error}
        </p>
      ) : !selectedBracket ? (
        <div className="mt-5 rounded-xl border border-dashed border-line px-5 py-12 text-center text-sm text-ink-muted">
          {t("competition.noRounds")}
        </div>
      ) : (
        <>
          <nav
            aria-label={t("competition.roundNavigation")}
            className="mt-5 flex max-w-full gap-2 overflow-x-auto pb-2"
          >
            {rounds.map(({ round }, index) => {
              const active = round.id === selectedBracket.round.id;
              return (
                <button
                  key={round.id}
                  type="button"
                  onClick={() => setSelectedRoundId(round.id)}
                  aria-current={active ? "step" : undefined}
                  className={`min-w-44 rounded-xl border px-4 py-3 text-left transition ${
                    active
                      ? "border-brand bg-brand/10"
                      : "border-line bg-surface-sub hover:border-line-strong"
                  }`}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                    {t("competition.stage")} {index + 1}
                  </span>
                  <span className="mt-1 block truncate text-sm font-semibold text-ink">
                    {round.name}
                  </span>
                  <span className="mt-1 block text-xs text-ink-muted">
                    {roundFormatLabel(round.format, t)}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-4 min-w-0 rounded-2xl border border-line bg-surface-sub/25 p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  {selectedBracket.round.name}
                </h3>
                <p className="mt-1 text-sm text-ink-muted">
                  {roundFormatLabel(selectedBracket.round.format, t)}
                </p>
              </div>
              <span className="rounded-full bg-surface-card px-3 py-1 text-xs font-medium text-ink-muted">
                {t(`round.status.${selectedBracket.round.status}` as TranslationKey)}
              </span>
            </div>

            <div className="mt-4">
              <RoundSettingsSummary round={selectedBracket.round} />
            </div>

            {selectedStandings && (
              <div className="mt-5">
                <RoundProgressionSummary data={selectedStandings} />
              </div>
            )}

            <div className="mt-6 min-w-0">
              <h3 className="mb-4 font-semibold text-ink">
                {t("competition.matchesAndSchedule")}
              </h3>
              <RoundCompetitionView bracket={selectedBracket} />
            </div>

            <div className="mt-8 border-t border-line pt-6">
              <h3 className="mb-4 font-semibold text-ink">
                {selectedBracket.round.format === "PLAYOFF" ||
                selectedBracket.round.format === "DOUBLE_ELIM"
                  ? t("competition.stageResults")
                  : t("competition.standings")}
              </h3>
              {selectedStandings && standings ? (
                <RoundStandingsView
                  data={selectedStandings}
                  round={selectedBracket.round}
                  tournament={standings.tournament}
                />
              ) : (
                <p className="text-sm text-ink-muted">
                  {t("competition.noStandings")}
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </section>
  );
}
