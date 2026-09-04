"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowCounterClockwiseIcon,
  ArrowRightIcon,
  ArrowsClockwiseIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  EyeIcon,
  PlayIcon,
  TrophyIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import {
  alertErrorClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { tournamentsApi } from "@/features/tournaments/api";
import { roundFormatLabel } from "@/features/tournaments/round-formats";
import type {
  BracketMatch,
  ChampionshipTieBreakDetails,
  DownstreamResetPreview,
  QualificationTieBreakDetails,
  RoundBracket,
  RoundGenerationPreview,
  RoundStandings,
  TournamentDetail,
  TournamentStandingsResponse,
} from "@/features/tournaments/types";
import { ApiError } from "@/lib/api/client";

import RoundCompetitionView from "./RoundCompetitionView";
import MatchManagementPanel from "./MatchManagementPanel";
import RoundProgressionSummary from "./RoundProgressionSummary";
import RoundStandingsView from "./RoundStandingsView";
import RoundSettingsSummary from "../competition/RoundSettingsSummary";
import RoundGenerationPreviewDialog from "./RoundGenerationPreviewDialog";
import DownstreamResetDialog from "./DownstreamResetDialog";
import CompetitionAuditHistory from "./CompetitionAuditHistory";
import { useLocale, type TranslationKey } from "@/features/locale/store";
import { useCompetitionInvalidation } from "@/features/tournaments/realtime";

const generateStructureButtonClass =
  "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-md bg-brand px-6 py-3 text-[0.8125rem] font-black uppercase tracking-wide text-on-brand shadow-[0_12px_30px_-14px_var(--color-brand)] transition hover:brightness-110 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-50";

const swissErrorTranslationByCode: Partial<Record<string, TranslationKey>> = {
  TOURNAMENT_NOT_MUTABLE: "swiss.blocked.TOURNAMENT_NOT_MUTABLE",
  ROUND_NOT_MUTABLE: "swiss.blocked.ROUND_NOT_MUTABLE",
  SWISS_ITERATION_NOT_COMPLETE: "swiss.blocked.CURRENT_ITERATION_INCOMPLETE",
  SWISS_ALL_ITERATIONS_COMPLETE: "swiss.blocked.ALL_ITERATIONS_COMPLETE",
  SWISS_STRUCTURE_INVALID: "swiss.blocked.STRUCTURE_INVALID",
};

const generationErrorTranslationByCode: Partial<
  Record<string, TranslationKey>
> = {
  TOURNAMENT_NOT_MUTABLE: "generation.blocked.TOURNAMENT_NOT_MUTABLE",
  REGISTRATION_MUST_BE_CLOSED: "generation.blocked.REGISTRATION_MUST_BE_CLOSED",
  PREVIOUS_ROUND_NOT_COMPLETE: "generation.blocked.PREVIOUS_ROUND_NOT_COMPLETE",
  ROUND_PARTICIPANTS_NOT_READY:
    "generation.blocked.ROUND_PARTICIPANTS_NOT_READY",
  ROUND_PARTICIPANTS_INELIGIBLE:
    "generation.blocked.ROUND_PARTICIPANTS_INELIGIBLE",
  ROUND_SEQUENCE_INVALID: "generation.blocked.ROUND_SEQUENCE_INVALID",
  ELIMINATION_MUST_BE_TERMINAL:
    "generation.blocked.ELIMINATION_MUST_BE_TERMINAL",
  ROUND_PREVIEW_STALE: "generation.blocked.ROUND_PREVIEW_STALE",
};

const advancementErrorTranslationByCode: Partial<
  Record<string, TranslationKey>
> = {
  TOURNAMENT_NOT_MUTABLE: "advancement.error.TOURNAMENT_NOT_MUTABLE",
  ROUND_NOT_MUTABLE: "advancement.error.ROUND_NOT_MUTABLE",
  PREVIOUS_ROUND_NOT_COMPLETE: "advancement.error.PREVIOUS_ROUND_NOT_COMPLETE",
  ROUND_ADVANCEMENT_SNAPSHOT_CHANGED:
    "advancement.error.ROUND_ADVANCEMENT_SNAPSHOT_CHANGED",
  ROUND_ADVANCEMENT_ALREADY_PERSISTED:
    "advancement.error.ROUND_ADVANCEMENT_ALREADY_PERSISTED",
  NEXT_ROUND_ALREADY_GENERATED:
    "advancement.error.NEXT_ROUND_ALREADY_GENERATED",
  ROUND_ADVANCEMENT_TARGET_INVALID:
    "advancement.error.ROUND_ADVANCEMENT_TARGET_INVALID",
  ROUND_TIE_BREAK_SELECTION_INVALID:
    "advancement.error.ROUND_TIE_BREAK_SELECTION_INVALID",
};

const finalizationErrorTranslationByCode: Partial<
  Record<string, TranslationKey>
> = {
  TOURNAMENT_NOT_MUTABLE: "finalization.error.TOURNAMENT_NOT_MUTABLE",
  TOURNAMENT_FINALIZATION_NOT_READY:
    "finalization.error.TOURNAMENT_FINALIZATION_NOT_READY",
  TOURNAMENT_FINALIZATION_UNSUPPORTED_FORMAT:
    "finalization.error.TOURNAMENT_FINALIZATION_UNSUPPORTED_FORMAT",
  TOURNAMENT_FINALIZATION_STANDINGS_INVALID:
    "finalization.error.TOURNAMENT_FINALIZATION_STANDINGS_INVALID",
  TOURNAMENT_CHAMPION_SELECTION_INVALID:
    "finalization.error.TOURNAMENT_CHAMPION_SELECTION_INVALID",
};

const downstreamResetErrorTranslationByCode: Partial<
  Record<string, TranslationKey>
> = {
  DOWNSTREAM_RESET_NOT_AVAILABLE:
    "competition.reset.error.DOWNSTREAM_RESET_NOT_AVAILABLE",
  DOWNSTREAM_RESET_TOURNAMENT_LOCKED:
    "competition.reset.error.DOWNSTREAM_RESET_TOURNAMENT_LOCKED",
  DOWNSTREAM_RESET_PREVIEW_STALE:
    "competition.reset.error.DOWNSTREAM_RESET_PREVIEW_STALE",
};

function parseQualificationTieBreakDetails(
  value: Record<string, unknown> | undefined,
): QualificationTieBreakDetails | null {
  if (!value || !Number.isInteger(value.advanceCount)) return null;
  if (
    !Array.isArray(value.fixedQualifiedTeams) ||
    !Array.isArray(value.tieBreaks)
  ) {
    return null;
  }
  const teams = value.fixedQualifiedTeams.filter(isQualificationDecisionTeam);
  const tieBreaks = value.tieBreaks.filter(
    (item): item is QualificationTieBreakDetails["tieBreaks"][number] => {
      if (!item || typeof item !== "object") return false;
      const candidate = item as Record<string, unknown>;
      return (
        (candidate.scope === "ROUND" || candidate.scope === "GROUP") &&
        (typeof candidate.groupId === "string" || candidate.groupId === null) &&
        (typeof candidate.groupName === "string" ||
          candidate.groupName === null) &&
        Number.isInteger(candidate.requiredSelections) &&
        Number(candidate.requiredSelections) > 0 &&
        Array.isArray(candidate.candidates) &&
        candidate.candidates.every(isQualificationDecisionTeam)
      );
    },
  );
  if (
    teams.length !== value.fixedQualifiedTeams.length ||
    tieBreaks.length !== value.tieBreaks.length ||
    tieBreaks.length === 0
  ) {
    return null;
  }
  return {
    advanceCount: Number(value.advanceCount),
    fixedQualifiedTeams: teams,
    tieBreaks,
  };
}

function isQualificationDecisionTeam(value: unknown): value is {
  teamId: string;
  name: string;
  seed: number | null;
} {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.teamId === "string" &&
    typeof candidate.name === "string" &&
    (typeof candidate.seed === "number" || candidate.seed === null)
  );
}

function parseChampionshipTieBreakDetails(
  value: Record<string, unknown> | undefined,
): ChampionshipTieBreakDetails | null {
  if (!value || !Array.isArray(value.candidates)) return null;
  const candidates = value.candidates.filter(isQualificationDecisionTeam);
  return candidates.length === value.candidates.length && candidates.length > 1
    ? { candidates }
    : null;
}

export default function CompetitionManager({
  tournament,
  onTournamentRefresh,
}: {
  tournament: TournamentDetail;
  onTournamentRefresh: () => Promise<void>;
}) {
  const { t } = useLocale();
  const rounds = useMemo(
    () =>
      [...(tournament.rounds ?? [])].sort(
        (a, b) => a.orderIndex - b.orderIndex,
      ),
    [tournament.rounds],
  );
  const [selectedRoundId, setSelectedRoundId] = useState(rounds[0]?.id ?? "");
  const [bracket, setBracket] = useState<RoundBracket | null>(null);
  const [standings, setStandings] =
    useState<TournamentStandingsResponse | null>(null);
  const [loading, setLoading] = useState(Boolean(rounds.length));
  const [working, setWorking] = useState<
    | "preview"
    | "generate"
    | "swiss"
    | "advance"
    | "finalize"
    | "resetPreview"
    | "reset"
    | null
  >(null);
  const [generationPreview, setGenerationPreview] =
    useState<RoundGenerationPreview | null>(null);
  const [downstreamResetPreview, setDownstreamResetPreview] =
    useState<DownstreamResetPreview | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);
  const [tieBreakDecision, setTieBreakDecision] =
    useState<QualificationTieBreakDetails | null>(null);
  const [selectedTieTeamIds, setSelectedTieTeamIds] = useState<string[]>([]);
  const [championshipTieBreak, setChampionshipTieBreak] =
    useState<ChampionshipTieBreakDetails | null>(null);
  const [selectedChampionTeamId, setSelectedChampionTeamId] = useState("");
  const loadRequestId = useRef(0);

  const selectedRound =
    rounds.find((round) => round.id === selectedRoundId) ?? rounds[0];
  const activeRound = bracket?.round ?? selectedRound;
  const activeStandings = standings?.rounds.find(
    (round): round is RoundStandings => round.roundId === selectedRound?.id,
  );

  const loadCompetition = useCallback(
    async (roundId: string) => {
      const requestId = ++loadRequestId.current;
      setLoading(true);
      setError("");
      try {
        const [bracketResponse, standingsResponse] = await Promise.all([
          tournamentsApi.getTournamentBracket(tournament.slug),
          tournamentsApi.getStandings(tournament.slug),
        ]);
        const selected = bracketResponse.rounds.find(
          (item) => item.round.id === roundId,
        );
        if (!selected)
          throw new Error(t("competition.manage.structureNotFound"));
        if (requestId !== loadRequestId.current) return;
        setBracket(selected);
        setStandings(standingsResponse);
      } catch (err) {
        if (requestId !== loadRequestId.current) return;
        setBracket(null);
        setStandings(null);
        setError(
          err instanceof Error
            ? err.message
            : t("competition.manage.loadError"),
        );
      } finally {
        if (requestId === loadRequestId.current) setLoading(false);
      }
    },
    [tournament.slug, t],
  );

  useEffect(() => {
    if (!selectedRound?.id) return;
    const timer = window.setTimeout(
      () => void loadCompetition(selectedRound.id),
      0,
    );
    return () => {
      window.clearTimeout(timer);
      loadRequestId.current += 1;
    };
  }, [loadCompetition, selectedRound?.id]);

  useCompetitionInvalidation(tournament.id, () => {
    if (selectedRound?.id) {
      void Promise.all([
        loadCompetition(selectedRound.id),
        onTournamentRefresh(),
      ]);
    }
  });

  const previewGeneration = async () => {
    if (!selectedRound || working) return;
    const force = Boolean(
      bracket && (bracket.matches.length || bracket.groups.length),
    );
    setWorking("preview");
    setError("");
    setNotice("");
    try {
      const preview = await tournamentsApi.previewRoundGeneration(
        selectedRound.id,
        force,
      );
      setGenerationPreview(preview);
    } catch (err) {
      const localizedError =
        err instanceof ApiError && err.code
          ? generationErrorTranslationByCode[err.code]
          : undefined;
      setError(
        localizedError
          ? t(localizedError)
          : err instanceof Error
            ? err.message
            : t("competition.preview.loadError"),
      );
    } finally {
      setWorking(null);
    }
  };

  const confirmGeneration = async () => {
    if (!selectedRound || !generationPreview || working) return;
    setWorking("generate");
    setError("");
    setNotice("");
    try {
      const result = await tournamentsApi.generateRound(
        selectedRound.id,
        generationPreview.force,
        generationPreview.previewToken,
      );
      setGenerationPreview(null);
      setNotice(
        `${t("competition.manage.generatedPrefix")} ${result.matchCount} ${t("competition.manage.fromApproved")} ${result.approvedTeamCount} ${t("competition.manage.approvedTeams")}`,
      );
      await loadCompetition(selectedRound.id);
    } catch (err) {
      const localizedError =
        err instanceof ApiError && err.code
          ? generationErrorTranslationByCode[err.code]
          : undefined;
      if (err instanceof ApiError && err.code === "ROUND_PREVIEW_STALE") {
        setGenerationPreview(null);
      }
      setError(
        localizedError
          ? t(localizedError)
          : err instanceof Error
            ? err.message
            : t("competition.manage.generateError"),
      );
    } finally {
      setWorking(null);
    }
  };

  const previewDownstreamReset = async () => {
    if (!selectedRound || working) return;
    setWorking("resetPreview");
    setError("");
    setNotice("");
    try {
      setDownstreamResetPreview(
        await tournamentsApi.previewDownstreamReset(selectedRound.id),
      );
    } catch (err) {
      const localizedError =
        err instanceof ApiError && err.code
          ? downstreamResetErrorTranslationByCode[err.code]
          : undefined;
      setError(
        localizedError
          ? t(localizedError)
          : err instanceof Error
            ? err.message
            : t("competition.reset.loadError"),
      );
    } finally {
      setWorking(null);
    }
  };

  const confirmDownstreamReset = async () => {
    if (!selectedRound || !downstreamResetPreview || working) return;
    setWorking("reset");
    setError("");
    setNotice("");
    try {
      const result = await tournamentsApi.resetDownstream(
        selectedRound.id,
        downstreamResetPreview.previewToken,
      );
      setDownstreamResetPreview(null);
      setNotice(
        `${t("competition.reset.successPrefix")} ${result.impact.roundCount} ${t("competition.reset.rounds")}.`,
      );
      await Promise.all([
        loadCompetition(selectedRound.id),
        onTournamentRefresh(),
      ]);
    } catch (err) {
      const localizedError =
        err instanceof ApiError && err.code
          ? downstreamResetErrorTranslationByCode[err.code]
          : undefined;
      if (
        err instanceof ApiError &&
        err.code === "DOWNSTREAM_RESET_PREVIEW_STALE"
      ) {
        setDownstreamResetPreview(null);
      }
      setError(
        localizedError
          ? t(localizedError)
          : err instanceof Error
            ? err.message
            : t("competition.reset.errorFallback"),
      );
    } finally {
      setWorking(null);
    }
  };

  const generateNextSwiss = async () => {
    if (!selectedRound || working) return;
    setWorking("swiss");
    setError("");
    setNotice("");
    try {
      const result = await tournamentsApi.generateNextSwissIteration(
        selectedRound.id,
      );
      const warning = result.warnings.length
        ? ` ${result.warnings.join(" ")}`
        : "";
      setNotice(
        `${t("competition.manage.swissGenerated")} ${result.bracketRound}/${result.numberOfRounds}.${warning}`,
      );
      await loadCompetition(selectedRound.id);
    } catch (err) {
      const localizedError =
        err instanceof ApiError && err.code
          ? swissErrorTranslationByCode[err.code]
          : undefined;
      setError(
        localizedError
          ? t(localizedError)
          : err instanceof Error
            ? err.message
            : t("competition.manage.swissGenerateError"),
      );
    } finally {
      setWorking(null);
    }
  };

  const advanceRound = async (qualifiedTeamIds?: string[]) => {
    if (!selectedRound || working) return;
    setWorking("advance");
    setError("");
    setNotice("");
    if (!qualifiedTeamIds) {
      setTieBreakDecision(null);
      setSelectedTieTeamIds([]);
    }
    try {
      const result = await tournamentsApi.advanceRound(
        selectedRound.id,
        qualifiedTeamIds,
      );
      setTieBreakDecision(null);
      setSelectedTieTeamIds([]);
      setNotice(
        `${t("competition.manage.advancedPrefix")} ${result.advanceCount} ${t("competition.manage.advancedInto")} ${result.nextRound?.name ?? t("competition.manage.nextRoundFallback")}.`,
      );
      await Promise.all([
        loadCompetition(selectedRound.id),
        onTournamentRefresh(),
      ]);
    } catch (err) {
      if (err instanceof ApiError && err.code === "ROUND_TIE_BREAK_REQUIRED") {
        const details = parseQualificationTieBreakDetails(err.details);
        if (details) {
          setTieBreakDecision(details);
          setSelectedTieTeamIds([]);
          return;
        }
      }
      const localizedError =
        err instanceof ApiError && err.code
          ? advancementErrorTranslationByCode[err.code]
          : undefined;
      setError(
        localizedError
          ? t(localizedError)
          : err instanceof Error
            ? err.message
            : t("competition.manage.advanceError"),
      );
    } finally {
      setWorking(null);
    }
  };

  const toggleTieBreakTeam = (teamId: string, tieBreakIndex: number) => {
    if (!tieBreakDecision || working) return;
    const tieBreak = tieBreakDecision.tieBreaks[tieBreakIndex];
    const candidateIds = new Set(
      tieBreak.candidates.map((candidate) => candidate.teamId),
    );
    setSelectedTieTeamIds((current) => {
      if (current.includes(teamId)) {
        return current.filter((selectedId) => selectedId !== teamId);
      }
      const selectedInTie = current.filter((selectedId) =>
        candidateIds.has(selectedId),
      ).length;
      return selectedInTie >= tieBreak.requiredSelections
        ? current
        : [...current, teamId];
    });
  };

  const tieBreakSelectionComplete =
    tieBreakDecision?.tieBreaks.every((tieBreak) => {
      const candidateIds = new Set(
        tieBreak.candidates.map((candidate) => candidate.teamId),
      );
      return (
        selectedTieTeamIds.filter((teamId) => candidateIds.has(teamId))
          .length === tieBreak.requiredSelections
      );
    }) ?? false;

  const confirmTieBreak = () => {
    if (!tieBreakDecision || !tieBreakSelectionComplete) return;
    void advanceRound([
      ...tieBreakDecision.fixedQualifiedTeams.map((team) => team.teamId),
      ...selectedTieTeamIds,
    ]);
  };

  const finalizeStandings = async (championTeamId?: string) => {
    if (working || activeStandings?.finalization.state !== "READY") return;
    if (
      !championTeamId &&
      !window.confirm(t("competition.manage.finalizeConfirm"))
    ) {
      return;
    }
    setWorking("finalize");
    setError("");
    setNotice("");
    if (!championTeamId) {
      setChampionshipTieBreak(null);
      setSelectedChampionTeamId("");
    }
    try {
      const result = await tournamentsApi.finalizeStandings(
        tournament.id,
        championTeamId,
      );
      setChampionshipTieBreak(null);
      setSelectedChampionTeamId("");
      setNotice(
        `${t("competition.manage.finalizedPrefix")} ${result.champion.name}.`,
      );
      await Promise.all([
        loadCompetition(selectedRound.id),
        onTournamentRefresh(),
      ]);
    } catch (err) {
      if (
        err instanceof ApiError &&
        err.code === "TOURNAMENT_CHAMPION_TIE_BREAK_REQUIRED"
      ) {
        const details = parseChampionshipTieBreakDetails(err.details);
        if (details) {
          setChampionshipTieBreak(details);
          return;
        }
      }
      const localizedError =
        err instanceof ApiError && err.code
          ? finalizationErrorTranslationByCode[err.code]
          : undefined;
      setError(
        localizedError
          ? t(localizedError)
          : err instanceof Error
            ? err.message
            : t("competition.manage.finalizeError"),
      );
    } finally {
      setWorking(null);
    }
  };

  if (!rounds.length) {
    return (
      <section className="rounded-2xl border border-dashed border-line px-6 py-14 text-center">
        <h2 className="font-semibold text-ink">
          {t("competition.manage.noStages")}
        </h2>
        <p className="mt-2 text-sm text-ink-muted">
          {t("competition.manage.noStagesHint")}
        </p>
      </section>
    );
  }

  const hasStructure = Boolean(
    bracket && (bracket.matches.length || bracket.groups.length),
  );
  const canRequestRegeneration = Boolean(
    bracket?.matches.length &&
    bracket.matches.every(
      (match) =>
        match.status === "PENDING" &&
        match.score.A === 0 &&
        match.score.B === 0 &&
        match.winner === null,
    ),
  );
  const swissProgress = activeStandings?.swissProgress ?? null;
  const actionsAllowed =
    tournament.status !== "CANCELLED" &&
    tournament.status !== "COMPLETED" &&
    activeRound?.status !== "COMPLETED";
  const advancementAllowed =
    tournament.status !== "CANCELLED" && tournament.status !== "COMPLETED";
  const canAdvance =
    advancementAllowed &&
    activeStandings?.advancement.state === "AWAITING_ADVANCEMENT" &&
    (activeRound?.format === "ROUND_ROBIN" ||
      activeRound?.format === "GROUP_STAGE" ||
      activeRound?.format === "SWISS");
  const canFinalizeStandings =
    tournament.status === "ONGOING" &&
    activeStandings?.finalization.state === "READY";
  const hasResettableDownstream = rounds.some((round) => {
    if (!selectedRound || round.orderIndex <= selectedRound.orderIndex) {
      return false;
    }
    const downstreamStandings = standings?.rounds.find(
      (candidate) => candidate.roundId === round.id,
    );
    return (
      round.status !== "UPCOMING" ||
      Boolean(downstreamStandings?.progress.totalMatches) ||
      Boolean(downstreamStandings?.participants.length)
    );
  });
  const canResetDownstream =
    tournament.status !== "DRAFT" &&
    tournament.status !== "CANCELLED" &&
    hasResettableDownstream;

  return (
    <section aria-labelledby="competition-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand">
            {t("competition.manage.eyebrow")}
          </p>
          <h2
            id="competition-heading"
            className="mt-1 text-xl font-bold text-ink sm:text-2xl"
          >
            {t("competition.manage.structure")}
          </h2>
          <p className="mt-2 text-sm text-ink-muted">
            {tournament.teams.length} {t("competition.manage.approvedTeams")}
            {tournament.maxTeams
              ? ` / ${t("competition.manage.maximum")} ${tournament.maxTeams}`
              : ""}{" "}
            · {tournament._count?.teams ?? tournament.teams.length}{" "}
            {t("competition.manage.registrations")}
          </p>
        </div>
        <span className="rounded-full border border-line bg-surface-sub px-3 py-1.5 text-xs text-ink-muted">
          {rounds.length} {t("competition.manage.stages")}
        </span>
      </div>

      <nav
        aria-label={t("competition.roundNavigation")}
        className="mt-5 flex gap-2 overflow-x-auto pb-2"
      >
        {rounds.map((round, index) => {
          const active = round.id === selectedRound?.id;
          return (
            <button
              key={round.id}
              type="button"
              onClick={() => {
                if (round.id === selectedRound?.id) return;
                setLoading(true);
                setError("");
                setBracket(null);
                setSelectedMatchId(null);
                setGenerationPreview(null);
                setDownstreamResetPreview(null);
                setSelectedRoundId(round.id);
                setNotice("");
                setTieBreakDecision(null);
                setSelectedTieTeamIds([]);
                setChampionshipTieBreak(null);
                setSelectedChampionTeamId("");
              }}
              className={`min-w-44 rounded-xl border px-4 py-3 text-left transition ${
                active
                  ? "border-brand bg-brand/10"
                  : "border-line bg-surface-card hover:border-line-strong"
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

      {selectedRound && (
        <div className="mt-4 rounded-2xl border border-line bg-surface-card p-4 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold text-ink">
                  {selectedRound.name}
                </h3>
                <span className="rounded-full bg-surface-sub px-2.5 py-1 text-[11px] text-ink-muted">
                  {t(`round.status.${selectedRound.status}` as TranslationKey)}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] ${hasStructure ? "bg-approved/10 text-approved" : "bg-pending/10 text-pending"}`}
                >
                  {hasStructure
                    ? t("competition.manage.generated")
                    : t("competition.manage.notGenerated")}
                </span>
              </div>
              <p className="mt-1 text-sm text-ink-muted">
                {roundFormatLabel(selectedRound.format, t)}
              </p>
            </div>

            {!loading &&
              (actionsAllowed ||
                canAdvance ||
                canFinalizeStandings ||
                canResetDownstream) && (
                <div className="flex flex-wrap gap-2">
                  {actionsAllowed &&
                    selectedRound.format === "SWISS" &&
                    hasStructure &&
                    swissProgress &&
                    !swissProgress.allIterationsComplete && (
                      <button
                        type="button"
                        onClick={generateNextSwiss}
                        disabled={
                          Boolean(working) || !swissProgress.canGenerateNext
                        }
                        title={
                          swissProgress.blockedReason
                            ? t(
                                `swiss.blocked.${swissProgress.blockedReason}` as TranslationKey,
                              )
                            : t("swiss.readyNext")
                        }
                        className={primaryButtonClass}
                      >
                        {working === "swiss" ? (
                          <CircleNotchIcon className="animate-spin" />
                        ) : (
                          <PlayIcon weight="fill" />
                        )}
                        {t("competition.manage.nextSwiss")}
                      </button>
                    )}
                  {actionsAllowed &&
                    (!hasStructure || canRequestRegeneration) && (
                      <button
                        type="button"
                        onClick={previewGeneration}
                        disabled={Boolean(working)}
                        className={
                          hasStructure
                            ? secondaryButtonClass
                            : generateStructureButtonClass
                        }
                      >
                        {working === "preview" ? (
                          <CircleNotchIcon className="animate-spin" />
                        ) : hasStructure ? (
                          <ArrowsClockwiseIcon />
                        ) : (
                          <EyeIcon weight="bold" />
                        )}
                        {hasStructure
                          ? t("competition.preview.previewRegeneration")
                          : t("competition.preview.previewGeneration")}
                      </button>
                    )}
                  {canAdvance && (
                    <button
                      type="button"
                      onClick={() => void advanceRound()}
                      disabled={Boolean(working)}
                      className={primaryButtonClass}
                    >
                      {working === "advance" ? (
                        <CircleNotchIcon className="animate-spin" />
                      ) : (
                        <ArrowRightIcon weight="bold" />
                      )}
                      {t("competition.manage.advance")}
                    </button>
                  )}
                  {canFinalizeStandings && (
                    <button
                      type="button"
                      onClick={() => void finalizeStandings()}
                      disabled={Boolean(working)}
                      className={primaryButtonClass}
                    >
                      {working === "finalize" ? (
                        <CircleNotchIcon className="animate-spin" />
                      ) : (
                        <TrophyIcon weight="fill" />
                      )}
                      {t("competition.manage.finalizeStandings")}
                    </button>
                  )}
                  {canResetDownstream && (
                    <button
                      type="button"
                      onClick={() => void previewDownstreamReset()}
                      disabled={Boolean(working)}
                      className="inline-flex min-h-[var(--control-height)] items-center justify-center gap-2 rounded-[var(--radius-control)] border border-rejected/45 bg-rejected/10 px-5 py-3 text-sm font-semibold text-rejected transition hover:bg-rejected/15 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {working === "resetPreview" ? (
                        <CircleNotchIcon className="animate-spin" />
                      ) : (
                        <ArrowCounterClockwiseIcon weight="bold" />
                      )}
                      {t("competition.reset.previewAction")}
                    </button>
                  )}
                </div>
              )}
          </div>

          <div className="mt-4">
            <RoundSettingsSummary round={activeRound} />
          </div>

          {notice && (
            <p
              role="status"
              className="mt-4 flex items-start gap-2 rounded-xl border border-approved/30 bg-approved/10 px-4 py-3 text-sm text-approved"
            >
              <CheckCircleIcon className="mt-0.5 shrink-0" />
              {notice}
            </p>
          )}
          {error && (
            <p
              role="alert"
              className={`${alertErrorClass} mt-4 flex items-start gap-2`}
            >
              <WarningCircleIcon className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}

          {tieBreakDecision && (
            <div className="mt-4 rounded-xl border border-pending/35 bg-pending/10 p-4">
              <div className="flex items-start gap-2">
                <WarningCircleIcon className="mt-0.5 shrink-0 text-pending" />
                <div>
                  <h4 className="font-semibold text-ink">
                    {t("competition.manage.tieBreakTitle")}
                  </h4>
                  <p className="mt-1 text-sm text-ink-muted">
                    {t("competition.manage.tieBreakDescription")}
                  </p>
                </div>
              </div>

              {tieBreakDecision.fixedQualifiedTeams.length > 0 && (
                <p className="mt-3 text-xs text-ink-muted">
                  {t("competition.manage.fixedQualified")}:{" "}
                  <strong className="text-ink">
                    {tieBreakDecision.fixedQualifiedTeams
                      .map((team) => team.name)
                      .join(", ")}
                  </strong>
                </p>
              )}

              <div className="mt-4 space-y-4">
                {tieBreakDecision.tieBreaks.map((tieBreak, tieBreakIndex) => {
                  const candidateIds = new Set(
                    tieBreak.candidates.map((candidate) => candidate.teamId),
                  );
                  const selectedCount = selectedTieTeamIds.filter((teamId) =>
                    candidateIds.has(teamId),
                  ).length;
                  return (
                    <fieldset
                      key={tieBreak.groupId ?? `round-${tieBreakIndex}`}
                      className="rounded-lg border border-line bg-surface-card p-3"
                    >
                      <legend className="px-1 text-sm font-semibold text-ink">
                        {tieBreak.groupName ??
                          t("competition.manage.overallStandings")}
                      </legend>
                      <p className="mb-3 text-xs text-ink-muted">
                        {t("competition.manage.selectTieTeams")}{" "}
                        {tieBreak.requiredSelections} · {selectedCount}/
                        {tieBreak.requiredSelections}
                      </p>
                      <div className="grid gap-2 sm:grid-cols-2">
                        {tieBreak.candidates.map((candidate) => {
                          const checked = selectedTieTeamIds.includes(
                            candidate.teamId,
                          );
                          const disabled =
                            !checked &&
                            selectedCount >= tieBreak.requiredSelections;
                          return (
                            <label
                              key={candidate.teamId}
                              className={`flex min-h-11 items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                                checked
                                  ? "border-brand bg-brand/10 text-ink"
                                  : "border-line bg-surface text-ink-muted"
                              } ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                disabled={disabled || Boolean(working)}
                                onChange={() =>
                                  toggleTieBreakTeam(
                                    candidate.teamId,
                                    tieBreakIndex,
                                  )
                                }
                                className="size-4 accent-brand"
                              />
                              <span className="font-medium">
                                {candidate.name}
                              </span>
                              {candidate.seed !== null && (
                                <span className="ml-auto text-xs text-ink-faint">
                                  Seed {candidate.seed}
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>
                    </fieldset>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={confirmTieBreak}
                disabled={!tieBreakSelectionComplete || Boolean(working)}
                className={`${primaryButtonClass} mt-4`}
              >
                {working === "advance" ? (
                  <CircleNotchIcon className="animate-spin" />
                ) : (
                  <ArrowRightIcon weight="bold" />
                )}
                {t("competition.manage.confirmTieBreak")}
              </button>
            </div>
          )}

          {championshipTieBreak && (
            <fieldset className="mt-4 rounded-xl border border-pending/35 bg-pending/10 p-4">
              <legend className="px-1 font-semibold text-ink">
                {t("competition.manage.championTieTitle")}
              </legend>
              <p className="mt-1 text-sm text-ink-muted">
                {t("competition.manage.championTieDescription")}
              </p>
              <div className="mt-4 grid gap-2 sm:grid-cols-2">
                {championshipTieBreak.candidates.map((candidate) => (
                  <label
                    key={candidate.teamId}
                    className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 text-sm ${
                      selectedChampionTeamId === candidate.teamId
                        ? "border-brand bg-brand/10 text-ink"
                        : "border-line bg-surface-card text-ink-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name="championTeamId"
                      value={candidate.teamId}
                      checked={selectedChampionTeamId === candidate.teamId}
                      disabled={Boolean(working)}
                      onChange={() =>
                        setSelectedChampionTeamId(candidate.teamId)
                      }
                      className="size-4 accent-brand"
                    />
                    <span className="font-medium">{candidate.name}</span>
                    {candidate.seed !== null && (
                      <span className="ml-auto text-xs text-ink-faint">
                        Seed {candidate.seed}
                      </span>
                    )}
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={!selectedChampionTeamId || Boolean(working)}
                onClick={() => void finalizeStandings(selectedChampionTeamId)}
                className={`${primaryButtonClass} mt-4`}
              >
                {working === "finalize" ? (
                  <CircleNotchIcon className="animate-spin" />
                ) : (
                  <TrophyIcon weight="fill" />
                )}
                {t("competition.manage.confirmChampion")}
              </button>
            </fieldset>
          )}

          <div className="mt-6">
            {loading ? (
              <div
                aria-label={t("competition.manage.loadingStructure")}
                className="grid min-h-48 place-items-center rounded-xl border border-line"
              >
                <CircleNotchIcon
                  className="animate-spin text-brand"
                  size={28}
                />
              </div>
            ) : bracket ? (
              <RoundCompetitionView
                bracket={bracket}
                onSelectMatch={(match: BracketMatch) =>
                  setSelectedMatchId(match.id)
                }
              />
            ) : (
              <div className="rounded-xl border border-dashed border-line px-5 py-10 text-center text-sm text-ink-muted">
                {t("competition.manage.noStructure")}
              </div>
            )}
          </div>

          <div className="mt-8 border-t border-line pt-6">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                {t("competition.manage.standingsEyebrow")}
              </p>
              <h3 className="mt-1 text-lg font-bold text-ink">
                {t("competition.manage.standingsTitle")}
              </h3>
            </div>
            {activeStandings && activeRound && standings ? (
              <div className="space-y-6">
                <RoundProgressionSummary data={activeStandings} />
                {["NOT_READY", "AUTOMATIC", "UNSUPPORTED"].includes(
                  activeStandings.finalization.state,
                ) && (
                  <p className="rounded-xl border border-line bg-surface-sub px-4 py-3 text-sm text-ink-muted">
                    {t(
                      `competition.finalization.${activeStandings.finalization.state}` as TranslationKey,
                    )}
                  </p>
                )}
                <RoundStandingsView
                  data={activeStandings}
                  round={activeRound}
                  tournament={standings.tournament}
                />
              </div>
            ) : !loading ? (
              <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-ink-muted">
                {t("competition.manage.noProgressData")}
              </p>
            ) : null}
          </div>
        </div>
      )}

      <CompetitionAuditHistory tournamentId={tournament.id} />

      {selectedMatchId && activeRound && (
        <MatchManagementPanel
          key={selectedMatchId}
          matchId={selectedMatchId}
          round={activeRound}
          tournamentStatus={tournament.status}
          onClose={() => setSelectedMatchId(null)}
          onMutation={async () => {
            await Promise.all([
              loadCompetition(activeRound.id),
              onTournamentRefresh(),
            ]);
          }}
        />
      )}

      {generationPreview && (
        <RoundGenerationPreviewDialog
          preview={generationPreview}
          isGenerating={working === "generate"}
          onClose={() => setGenerationPreview(null)}
          onConfirm={() => void confirmGeneration()}
        />
      )}

      {downstreamResetPreview && (
        <DownstreamResetDialog
          preview={downstreamResetPreview}
          isResetting={working === "reset"}
          onClose={() => setDownstreamResetPreview(null)}
          onConfirm={() => void confirmDownstreamReset()}
        />
      )}
    </section>
  );
}
