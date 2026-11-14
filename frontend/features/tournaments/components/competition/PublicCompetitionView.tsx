"use client";

import { useEffect, useMemo, useState } from "react";
import { CircleNotchIcon, WarningCircleIcon } from "@phosphor-icons/react";
import { alertErrorClass } from "@/components/ui";
import { LoadingStatus } from "@/components/Loading";
import { tournamentsApi } from "@/features/tournaments/api";
import { roundFormatLabel } from "@/features/tournaments/round-formats";
import type {
  RoundBracket,
  RoundStandings,
  TournamentStandingsResponse,
} from "@/features/tournaments/types";
import RoundCompetitionView from "../manage/RoundCompetitionView";
import RoundStandingsView from "../manage/RoundStandingsView";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { useCompetitionInvalidation } from "@/features/tournaments/realtime";
import PublicStageNavigation from "./PublicStageNavigation";
import PublicStageDetails from "./PublicStageDetails";
import PublicMatchDialog from "@/features/matches/components/PublicMatchDialog";
import styles from "./PublicCompetitionView.module.css";

export default function PublicCompetitionView({
  id,
  slug,
  tournamentId,
  bannerUrl,
  tournamentName,
}: {
  id?: string;
  slug: string;
  tournamentId: string;
  bannerUrl?: string | null;
  tournamentName?: string;
}) {
  const { t } = useLocale();
  const [rounds, setRounds] = useState<RoundBracket[]>([]);
  const [standings, setStandings] =
    useState<TournamentStandingsResponse | null>(null);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [standingsLoading, setStandingsLoading] = useState(true);
  const [standingsError, setStandingsError] = useState("");
  const [standingsAttempt, setStandingsAttempt] = useState(0);
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    tournamentsApi.getTournamentBracket(slug, controller.signal)
      .then((bracketResponse) => {
        if (cancelled) return;
        const orderedRounds = [...bracketResponse.rounds].sort(
          (a, b) => a.round.orderIndex - b.round.orderIndex,
        );
        setRounds(orderedRounds);
        setError("");
        setSelectedRoundId((current) =>
          orderedRounds.some(({ round }) => round.id === current)
            ? current
            : (orderedRounds.find(({ round }) => round.status === "ONGOING")
                ?.round.id ??
              orderedRounds.find(({ round }) => round.status === "UPCOMING")
                ?.round.id ??
              orderedRounds.at(-1)?.round.id ??
              ""),
        );
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setError(
          reason instanceof Error ? reason.message : t("competition.loadError"),
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [refreshVersion, slug, t]);

  // Match browsing does not need to wait for standings and progression data.
  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    tournamentsApi.getStandings(slug, controller.signal)
      .then((response) => {
        if (cancelled) return;
        setStandings(response);
        setStandingsError("");
      })
      .catch((reason: unknown) => {
        if (cancelled) return;
        setStandings(null);
        setStandingsError(
          reason instanceof Error ? reason.message : t("competition.loadError"),
        );
      })
      .finally(() => {
        if (!cancelled) setStandingsLoading(false);
      });
    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [refreshVersion, slug, standingsAttempt, t]);

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
  const selectedMatch = rounds
    .flatMap((round) => round.matches)
    .find((match) => match.id === selectedMatchId);
  const showSeparateStandings = selectedBracket?.round.format === "SWISS";

  return (
    <section
      id={id}
      aria-labelledby="public-competition-heading"
      className={styles.root}
    >
      <header className={styles.header}>
        <h2 id="public-competition-heading" className={styles.title}>
          {t("competition.publicHeading")}
        </h2>
        {standings?.tournament.champion && (
          <p className={styles.champion}>
            <span>{t("standings.champion")}</span>
            <strong>{standings.tournament.champion.name}</strong>
          </p>
        )}
      </header>

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
          <PublicStageNavigation
            rounds={rounds.map(({ round }) => round)}
            selectedRoundId={selectedBracket.round.id}
            onSelect={setSelectedRoundId}
          />

          <div className={styles.stageContent}>
            {standingsLoading && ["PLAYOFF", "DOUBLE_ELIM"].includes(selectedBracket.round.format) && (
              <LoadingStatus label={t("competition.standingsLoading")} />
            )}
            {standingsError && (
              <div role="alert" className={alertErrorClass}>
                <p>{t("competition.standingsLoadError")} {standingsError}</p>
                <button
                  type="button"
                  className="mt-2 min-h-9 font-semibold underline underline-offset-4"
                  disabled={standingsLoading}
                  onClick={() => {
                    setStandingsLoading(true);
                    setStandingsError("");
                    setStandingsAttempt((attempt) => attempt + 1);
                  }}
                >
                  {t("common.retry")}
                </button>
              </div>
            )}
            <div className={styles.stageSummary}>
              <div className={styles.stageIdentity}>
                <span className={styles.format}>
                  {roundFormatLabel(selectedBracket.round.format, t)}
                </span>
                <span
                  className={styles.stageStatus}
                  data-status={selectedBracket.round.status}
                >
                  {t(
                    `round.status.${selectedBracket.round.status}` as TranslationKey,
                  )}
                </span>
              </div>
              {selectedStandings && selectedStandings.progress.requiredMatches > 0 && (
                <p className={styles.progress}>
                  <strong>
                    {selectedStandings.progress.completedRequiredMatches}/
                    {selectedStandings.progress.requiredMatches}
                  </strong>{" "}
                  {t("competition.matchesCompleted")}
                </p>
              )}
            </div>
            {selectedStandings?.advancement.nextRound &&
              selectedStandings.advancement.nextRound.participantCount > 0 && (
                <p className={styles.nextStage}>
                  {selectedStandings.advancement.nextRound.participantCount}{" "}
                  {t("competition.teamsInto")} {selectedStandings.advancement.nextRound.name}
                </p>
              )}

            <div className={styles.competition}>
              <RoundCompetitionView
                bracket={selectedBracket}
                showHint={false}
                bannerUrl={bannerUrl}
                tournamentName={tournamentName}
                standings={selectedStandings}
                standingsLoading={standingsLoading}
                onSelectMatch={(match) => setSelectedMatchId(match.id)}
              />
            </div>

            {showSeparateStandings && (
              <div className={styles.standings}>
                <h3>{t("competition.standings")}</h3>
                {selectedStandings && standings ? (
                  <RoundStandingsView
                    data={selectedStandings}
                    round={selectedBracket.round}
                    tournament={standings.tournament}
                  />
                ) : standingsLoading ? (
                  <LoadingStatus label={t("competition.standingsLoading")} />
                ) : (
                  <p className="text-sm text-ink-muted">
                    {t("competition.noStandings")}
                  </p>
                )}
              </div>
            )}

            <PublicStageDetails
              key={selectedBracket.round.id}
              round={selectedBracket.round}
              standings={selectedStandings}
            />
          </div>
        </>
      )}
      {!error && selectedMatch && (
        <PublicMatchDialog
          key={selectedMatch.id}
          match={selectedMatch}
          onClose={() => setSelectedMatchId(null)}
        />
      )}
    </section>
  );
}
