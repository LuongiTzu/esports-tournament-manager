"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { createPortal } from "react-dom";
import {
  CalendarBlankIcon,
  CheckCircleIcon,
  CircleNotchIcon,
  LinkIcon,
  PlusIcon,
  TrashIcon,
  TrophyIcon,
  WarningCircleIcon,
  XIcon,
} from "@phosphor-icons/react";
import { MatchSkeleton } from "./ManagementSkeletons";
import ResolvedImage from "@/components/ResolvedImage";
import {
  alertErrorClass,
  inputClass,
  labelClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/ui";
import { matchesApi } from "@/features/matches/api";
import { ApiError } from "@/lib/api/client";
import type { MatchDetail } from "@/features/matches/types";
import { roundFormatLabel } from "@/features/tournaments/round-formats";
import type {
  MatchStatus,
  TournamentRound,
} from "@/features/tournaments/types";
import type { TournamentStatus } from "@/shared/types/tournament-status";
import { formatLocalizedDate } from "@/features/locale/format";
import { useLocale, type TranslationKey } from "@/features/locale/store";

interface EditableGameScore {
  teamAScore: string;
  teamBScore: string;
}

const resultButtonClass = `${primaryButtonClass} bg-none! bg-brand shadow-none!`;

const subscribeToDocument = () => () => {};
const getPortalTarget = () => document.body;
const getServerPortalTarget = () => null;

const resultErrorTranslationByCode: Partial<Record<string, TranslationKey>> = {
  TOURNAMENT_NOT_MUTABLE: "match.manage.error.TOURNAMENT_NOT_MUTABLE",
  ROUND_NOT_MUTABLE: "match.manage.error.ROUND_NOT_MUTABLE",
  UPSTREAM_RESULT_LOCKED_BY_DOWNSTREAM_STRUCTURE:
    "match.manage.error.UPSTREAM_RESULT_LOCKED_BY_DOWNSTREAM_STRUCTURE",
  FINAL_STANDINGS_RESULT_LOCKED:
    "match.manage.error.FINAL_STANDINGS_RESULT_LOCKED",
};

function toLocalDateTime(value: string | null) {
  if (!value) return "";
  const date = new Date(value);
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function TeamHeading({ match, slot }: { match: MatchDetail; slot: "A" | "B" }) {
  const { t } = useLocale();
  const team = slot === "A" ? match.teamA : match.teamB;
  return (
    <div className="min-w-0 text-center">
      <span className="mx-auto grid size-11 place-items-center overflow-hidden rounded-xl border border-brand/20 bg-brand/10 font-bold text-brand-hover sm:size-12">
        {team ? (
          <ResolvedImage
            src={team.logoUrl}
            alt={`${t("tournament.detail.teamLogoAlt")} ${team.name}`}
            className="size-full object-cover object-center"
            fallback={team.name.charAt(0).toUpperCase()}
          />
        ) : (
          "?"
        )}
      </span>
      <p className="mt-2 min-h-10 break-words text-sm font-semibold leading-snug text-ink sm:min-h-0">
        {team?.name ?? t("match.awaitingTeam")}
      </p>
      {team?.seed != null && (
        <p className="text-[11px] text-ink-faint">
          {t("match.seed")} #{team.seed}
        </p>
      )}
    </div>
  );
}

function allowsDraws(round: TournamentRound) {
  return (
    (round.format === "ROUND_ROBIN" || round.format === "GROUP_STAGE") &&
    round.settings.allowDraws
  );
}

export default function MatchManagementPanel({
  matchId,
  round,
  tournamentStatus,
  onClose,
  onMutation,
}: {
  matchId: string;
  round: TournamentRound;
  tournamentStatus: TournamentStatus;
  onClose: () => void;
  onMutation: () => Promise<void>;
}) {
  const { locale, t } = useLocale();
  const [match, setMatch] = useState<MatchDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [retryVersion, setRetryVersion] = useState(0);
  const [saving, setSaving] = useState<"schedule" | "result" | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [discordLink, setDiscordLink] = useState("");
  const [scoreA, setScoreA] = useState("0");
  const [scoreB, setScoreB] = useState("0");
  const [resultStatus, setResultStatus] = useState<MatchStatus>("PENDING");
  const [usePerGameScores, setUsePerGameScores] = useState(false);
  const [gameScores, setGameScores] = useState<EditableGameScore[]>([]);
  const portalTarget = useSyncExternalStore(
    subscribeToDocument,
    getPortalTarget,
    getServerPortalTarget,
  );
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!portalTarget) return;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      if (previousFocus instanceof HTMLElement) previousFocus.focus();
    };
  }, [portalTarget]);

  const populate = useCallback((value: MatchDetail) => {
    setMatch(value);
    setScheduledAt(toLocalDateTime(value.scheduledAt));
    setDiscordLink(value.discordLink ?? "");
    setScoreA(String(value.scoreA));
    setScoreB(String(value.scoreB));
    setResultStatus(value.status);
    setUsePerGameScores(value.scores.length > 0);
    setGameScores(
      value.scores.map((score) => ({
        teamAScore: String(score.teamAScore),
        teamBScore: String(score.teamBScore),
      })),
    );
  }, []);

  const loadMatch = useCallback(async () => {
    populate(await matchesApi.findOne(matchId));
  }, [matchId, populate]);

  useEffect(() => {
    let cancelled = false;
    matchesApi
      .findOne(matchId)
      .then((response) => {
        if (!cancelled) populate(response);
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : t("match.manage.loadError"),
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [matchId, populate, t, retryVersion]);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !saving) onClose();
      if (event.key !== "Tab") return;
      const focusable = panelRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]',
      );
      if (!focusable?.length) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const focusOutside = !panelRef.current?.contains(document.activeElement);
      if (
        event.shiftKey &&
        (document.activeElement === first || focusOutside)
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        (document.activeElement === last || focusOutside)
      ) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, saving]);

  const editingReason = !match
    ? t("match.manage.noData")
    : match.isBye
      ? t("match.manage.byeReadOnly")
      : !match.isActive
        ? t("match.manage.inactiveReadOnly")
        : !match.teamA || !match.teamB
          ? t("match.manage.missingTeams")
          : tournamentStatus === "CANCELLED"
            ? t("match.manage.cancelledTournament")
            : null;
  const editable = editingReason === null;
  const drawAllowed = allowsDraws(round);
  const scoringMode = round.settings.scoringMode ?? "SERIES_SCORE";
  const pointScoring = scoringMode === "POINT_SCORE";
  const resultIsCorrection = match?.status === "COMPLETED";

  const refreshAfterMutation = async (message: string) => {
    await Promise.all([onMutation(), loadMatch()]);
    setSuccess(message);
  };

  const saveSchedule = async () => {
    if (!match || !editable || saving) return;
    const trimmedLink = discordLink.trim();
    if (trimmedLink) {
      try {
        new URL(trimmedLink);
      } catch {
        setError(t("match.manage.linkInvalid"));
        return;
      }
    }
    setSaving("schedule");
    setError("");
    setSuccess("");
    try {
      await matchesApi.update(match.id, {
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        discordLink: trimmedLink || null,
      });
      await refreshAfterMutation(t("match.manage.scheduleUpdated"));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : t("match.manage.scheduleUpdateError"),
      );
    } finally {
      setSaving(null);
    }
  };

  const validateAggregateResult = () => {
    if (!match) return null;
    const parsedA = Number(scoreA);
    const parsedB = Number(scoreB);
    if (
      !Number.isInteger(parsedA) ||
      !Number.isInteger(parsedB) ||
      parsedA < 0 ||
      parsedB < 0
    ) {
      return t(
        pointScoring
          ? "match.manage.pointScoreInvalid"
          : "match.manage.seriesScoreInvalid",
      );
    }
    if (pointScoring) {
      if (resultStatus === "COMPLETED" && parsedA === parsedB && !drawAllowed) {
        return t("match.manage.decisiveRequired");
      }
      return { scoreA: parsedA, scoreB: parsedB };
    }
    const winsRequired = Math.floor(match.bestOf / 2) + 1;
    if (
      parsedA > winsRequired ||
      parsedB > winsRequired ||
      parsedA + parsedB > match.bestOf
    ) {
      return `${t("match.manage.scoreBestOfInvalid")} BO${match.bestOf}.`;
    }
    if (resultStatus === "COMPLETED") {
      if (parsedA === parsedB && !drawAllowed) {
        return t("match.manage.decisiveRequired");
      }
      if (
        parsedA !== parsedB &&
        parsedA !== winsRequired &&
        parsedB !== winsRequired
      ) {
        return `${t("match.manage.winnerRequiredPrefix")} ${winsRequired} ${t("match.manage.gamesUnit")}`;
      }
    } else if (parsedA === winsRequired || parsedB === winsRequired) {
      return t("match.manage.seriesCompleteStatus");
    }
    return { scoreA: parsedA, scoreB: parsedB };
  };

  const saveAggregateResult = async () => {
    if (!match || !editable || saving) return;
    const validated = validateAggregateResult();
    if (typeof validated === "string") {
      setError(validated);
      return;
    }
    if (!validated) return;
    if (
      resultIsCorrection &&
      !window.confirm(t("match.manage.correctResultConfirm"))
    ) {
      return;
    }
    setSaving("result");
    setError("");
    setSuccess("");
    try {
      await matchesApi.update(match.id, {
        ...validated,
        status: resultStatus,
      });
      await refreshAfterMutation(t("match.manage.resultUpdated"));
    } catch (err) {
      const localizedError =
        err instanceof ApiError && err.code
          ? resultErrorTranslationByCode[err.code]
          : undefined;
      setError(
        localizedError
          ? t(localizedError)
          : err instanceof Error
            ? err.message
            : t("match.manage.resultUpdateError"),
      );
    } finally {
      setSaving(null);
    }
  };

  const savePerGameScores = async () => {
    if (!match || !editable || saving) return;
    if (!gameScores.length) {
      setError(t("match.manage.gameScoreRequired"));
      return;
    }
    const parsed = gameScores.map((score, index) => ({
      setNumber: index + 1,
      teamAScore: Number(score.teamAScore),
      teamBScore: Number(score.teamBScore),
    }));
    if (
      parsed.some(
        (score) =>
          !Number.isInteger(score.teamAScore) ||
          !Number.isInteger(score.teamBScore) ||
          score.teamAScore < 0 ||
          score.teamBScore < 0 ||
          (score.teamAScore === score.teamBScore &&
            (!pointScoring || !drawAllowed)),
      )
    ) {
      setError(
        t(
          pointScoring
            ? "match.manage.pointDetailedScoreInvalid"
            : "match.manage.gameScoreInvalid",
        ),
      );
      return;
    }
    if (
      resultIsCorrection &&
      !window.confirm(t("match.manage.correctGameScoresConfirm"))
    ) {
      return;
    }
    setSaving("result");
    setError("");
    setSuccess("");
    try {
      await matchesApi.putScores(match.id, { scores: parsed });
      await refreshAfterMutation(t("match.manage.gameScoresUpdated"));
    } catch (err) {
      const localizedError =
        err instanceof ApiError && err.code
          ? resultErrorTranslationByCode[err.code]
          : undefined;
      setError(
        localizedError
          ? t(localizedError)
          : err instanceof Error
            ? err.message
            : t("match.manage.gameScoresUpdateError"),
      );
    } finally {
      setSaving(null);
    }
  };

  const chooseDraw = () => {
    if (!match || !drawAllowed || usePerGameScores) return;
    const currentA = Number(scoreA);
    const currentB = Number(scoreB);
    const drawScore = pointScoring
      ? Number.isInteger(currentA) && currentA >= 0 && currentA === currentB
        ? currentA
        : 0
      : Math.floor(match.bestOf / 2);
    setScoreA(String(drawScore));
    setScoreB(String(drawScore));
    setResultStatus("COMPLETED");
    setError("");
  };

  if (!portalTarget) return null;

  const formatLabel = roundFormatLabel(round.format, t);
  const normalizedRoundName = round.name
    .toLocaleLowerCase(locale)
    .replace(/[–—-]/g, "-")
    .trim();
  const normalizedFormatLabel = formatLabel
    .toLocaleLowerCase(locale)
    .replace(/[–—-]/g, "-")
    .trim();
  const statusTone =
    match?.status === "COMPLETED"
      ? "bg-approved/10 text-approved"
      : match?.status === "ONGOING"
        ? "bg-pending/10 text-pending"
        : "bg-surface-hover text-ink-muted";

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-3 backdrop-blur-sm sm:p-6">
      <section
        ref={panelRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="match-panel-title"
        className="flex max-h-[calc(100dvh-1.5rem)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-line bg-surface-card shadow-2xl outline-none sm:max-h-[calc(100dvh-3rem)]"
      >
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-line px-4 py-4 sm:px-6">
          <div className="min-w-0">
            <h2 id="match-panel-title" className="text-lg font-bold text-ink">
              {t("match.manage.title")} {match?.matchNumber ?? ""}
            </h2>
            <p className="mt-1 break-words text-xs leading-relaxed text-ink-muted">
              {round.name}
              {normalizedRoundName !== normalizedFormatLabel && (
                <span className="text-ink-faint"> · {formatLabel}</span>
              )}
            </p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            aria-label={t("common.close")}
            onClick={onClose}
            disabled={Boolean(saving)}
            className="grid size-9 shrink-0 place-items-center rounded-lg border border-line text-ink-muted transition hover:bg-surface-hover hover:text-ink focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
          >
            <XIcon size={20} />
          </button>
        </header>

        <div className="min-h-0 overflow-y-auto overscroll-contain [scrollbar-color:var(--color-line-strong)_transparent] [scrollbar-width:thin]">
          {loading ? (
            <MatchSkeleton label={t("common.loading")} />
          ) : match ? (
            <div className="space-y-4 p-4 sm:p-6">
              <div className="overflow-hidden rounded-xl border border-line bg-surface-sub/60">
                <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-start gap-3 px-3 py-5 sm:gap-6 sm:px-6">
                  <TeamHeading match={match} slot="A" />
                  <div className="self-center text-center">
                    <p className="flex items-center justify-center gap-3 font-mono text-3xl font-bold tabular-nums text-ink sm:gap-5 sm:text-4xl">
                      <span>{match.scoreA}</span>
                      <span className="text-lg font-normal text-ink-faint">
                        :
                      </span>
                      <span>{match.scoreB}</span>
                    </p>
                    <span
                      className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${statusTone}`}
                    >
                      <span
                        aria-hidden="true"
                        className="size-1.5 rounded-full bg-current"
                      />
                      {t(`match.status.${match.status}` as TranslationKey)}
                    </span>
                    <p className="mt-1 text-[11px] text-ink-faint">
                      {pointScoring
                        ? t("round.settings.scoringMode.POINT_SCORE")
                        : `BO${match.bestOf}`}
                    </p>
                  </div>
                  <TeamHeading match={match} slot="B" />
                </div>

                {(match.outcome === "DRAW" ||
                  match.winner ||
                  match.isBye ||
                  !match.isActive) && (
                  <div className="flex flex-wrap items-center justify-center gap-2 px-3 pb-4 text-xs">
                    {match.outcome === "DRAW" && (
                      <span className="rounded-full bg-pending/10 px-3 py-1.5 font-semibold text-pending">
                        {t("match.drawResult")}
                      </span>
                    )}
                    {match.winner && (
                      <span className="rounded-full bg-approved/10 px-3 py-1.5 text-approved">
                        {t("match.manage.winner")}: {match.winner.name}
                      </span>
                    )}
                    {match.isBye && (
                      <span className="rounded-full bg-brand/10 px-3 py-1.5 text-brand">
                        BYE
                      </span>
                    )}
                    {!match.isActive && (
                      <span className="rounded-full bg-rejected/10 px-3 py-1.5 text-rejected">
                        {t("match.inactive")}
                      </span>
                    )}
                  </div>
                )}

                <dl className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-line px-4 py-3 text-xs">
                  <div className="flex items-center gap-2">
                    <dt className="text-xs text-ink-faint">
                      {t("match.manage.roundIteration")}
                    </dt>
                    <dd className="font-medium text-ink">
                      {match.bracketRound ?? t("match.manage.notApplicable")}
                    </dd>
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
                    <dt className="text-xs text-ink-faint">
                      {t("match.manage.currentSchedule")}
                    </dt>
                    <dd className="font-medium text-ink">
                      {match.scheduledAt
                        ? formatLocalizedDate(match.scheduledAt, locale, {
                            dateStyle: "medium",
                            timeStyle: "short",
                          })
                        : t("match.manage.unscheduled")}
                    </dd>
                  </div>
                </dl>
              </div>

              {editingReason && (
                <p className="rounded-xl border border-pending/30 bg-pending/10 px-4 py-3 text-sm text-pending">
                  {editingReason}. {t("match.manage.readOnlySuffix")}
                </p>
              )}

              {error && (
                <p
                  role="alert"
                  className={`${alertErrorClass} flex items-start gap-2`}
                >
                  <WarningCircleIcon className="mt-0.5 shrink-0" />
                  {error}
                </p>
              )}
              {success && (
                <p
                  role="status"
                  className="flex items-start gap-2 rounded-xl border border-approved/30 bg-approved/10 px-4 py-3 text-sm text-approved"
                >
                  <CheckCircleIcon className="mt-0.5 shrink-0" />
                  {success}
                </p>
              )}

              {editable && (
                <fieldset
                  disabled={Boolean(saving)}
                  aria-busy={Boolean(saving)}
                  className="grid min-w-0 gap-4 md:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
                >
                  <section
                    aria-labelledby="schedule-heading"
                    className="flex min-w-0 flex-col rounded-xl border border-line p-4 sm:p-5"
                  >
                    <h3
                      id="schedule-heading"
                      className="flex items-center gap-2 text-sm font-bold text-ink"
                    >
                      <CalendarBlankIcon
                        size={18}
                        className="text-brand-hover"
                      />
                      {t("match.manage.schedule")}
                    </h3>
                    <div className="mt-4 grid gap-4">
                      <label className="min-w-0">
                        <span className={labelClass}>
                          {t("match.manage.dateTime")}
                        </span>
                        <span className="relative block">
                          <input
                            type="datetime-local"
                            value={scheduledAt}
                            onChange={(event) =>
                              setScheduledAt(event.target.value)
                            }
                            className={`${inputClass} min-w-0 max-w-full`}
                          />
                        </span>
                      </label>
                      <label>
                        <span className={labelClass}>
                          {t("match.manage.roomLink")}
                        </span>
                        <span className="relative block">
                          <LinkIcon className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
                          <input
                            type="url"
                            value={discordLink}
                            onChange={(event) =>
                              setDiscordLink(event.target.value)
                            }
                            placeholder="https://..."
                            className={`${inputClass} pl-10`}
                          />
                        </span>
                      </label>
                    </div>
                    <div className="mt-auto pt-5">
                      <button
                        type="button"
                        onClick={saveSchedule}
                        disabled={Boolean(saving)}
                        className={`${secondaryButtonClass} w-full`}
                      >
                        {saving === "schedule" && (
                          <CircleNotchIcon
                            aria-hidden="true"
                            className="motion-safe:animate-spin"
                          />
                        )}
                        {saving === "schedule"
                          ? t("common.saving")
                          : t("match.manage.saveSchedule")}
                      </button>
                    </div>
                  </section>

                  <section
                    aria-labelledby="result-heading"
                    className="min-w-0 rounded-xl border border-brand/20 p-4 sm:p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h3
                          id="result-heading"
                          className="flex items-center gap-2 text-sm font-bold text-ink"
                        >
                          <TrophyIcon size={18} className="text-brand-hover" />
                          {t("match.manage.result")}
                        </h3>
                        <p className="mt-2 text-xs leading-relaxed text-ink-muted">
                          {t(
                            pointScoring
                              ? "match.manage.pointScoreHint"
                              : "match.manage.seriesScoreHint",
                          )}{" "}
                          {drawAllowed
                            ? t("match.manage.drawAllowed")
                            : t("match.manage.decisiveOnly")}
                        </p>
                      </div>
                      {!pointScoring && match.scores.length === 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setUsePerGameScores((current) => !current);
                            setError("");
                          }}
                          aria-pressed={usePerGameScores}
                          className="rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-xs font-semibold text-brand-hover transition hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-brand"
                        >
                          {usePerGameScores
                            ? t("match.manage.enterSeries")
                            : t("match.manage.enterGames")}
                        </button>
                      )}
                    </div>

                    {usePerGameScores ? (
                      <div className="mt-4 space-y-3">
                        {gameScores.map((score, index) => (
                          <div
                            key={index}
                            className="grid grid-cols-[auto_minmax(0,1fr)_auto_minmax(0,1fr)_auto] items-center gap-2"
                          >
                            <span className="text-xs text-ink-faint">
                              G{index + 1}
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={score.teamAScore}
                              aria-label={`${t("match.manage.gameScoreAria")} ${index + 1} ${t("match.manage.of")} ${match.teamA?.name}`}
                              onChange={(event) =>
                                setGameScores((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          teamAScore: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              className={`${inputClass} min-w-0 px-2! text-center tabular-nums`}
                            />
                            <span className="text-ink-faint">–</span>
                            <input
                              type="number"
                              min={0}
                              value={score.teamBScore}
                              aria-label={`${t("match.manage.gameScoreAria")} ${index + 1} ${t("match.manage.of")} ${match.teamB?.name}`}
                              onChange={(event) =>
                                setGameScores((current) =>
                                  current.map((item, itemIndex) =>
                                    itemIndex === index
                                      ? {
                                          ...item,
                                          teamBScore: event.target.value,
                                        }
                                      : item,
                                  ),
                                )
                              }
                              className={`${inputClass} min-w-0 px-2! text-center tabular-nums`}
                            />
                            <button
                              type="button"
                              aria-label={`${t("match.manage.removeGame")} ${index + 1}`}
                              onClick={() =>
                                setGameScores((current) =>
                                  current.filter(
                                    (_, itemIndex) => itemIndex !== index,
                                  ),
                                )
                              }
                              className="grid size-9 place-items-center rounded-lg text-ink-faint hover:bg-rejected/10 hover:text-rejected"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        ))}
                        {gameScores.length < match.bestOf && (
                          <button
                            type="button"
                            onClick={() =>
                              setGameScores((current) => [
                                ...current,
                                { teamAScore: "", teamBScore: "" },
                              ])
                            }
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand hover:underline"
                          >
                            <PlusIcon /> {t("match.manage.addGame")}
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={savePerGameScores}
                          disabled={Boolean(saving)}
                          className={`${resultButtonClass} mt-2 w-full`}
                        >
                          {saving === "result" && (
                            <CircleNotchIcon
                              aria-hidden="true"
                              className="motion-safe:animate-spin"
                            />
                          )}
                          {saving === "result"
                            ? t("common.saving")
                            : resultIsCorrection
                              ? t("match.manage.confirmGameScoreCorrection")
                              : t("match.manage.saveGameScores")}
                        </button>
                      </div>
                    ) : (
                      <div className="mt-4">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-end gap-3">
                          <label className="min-w-0">
                            <span
                              className={`${labelClass} truncate text-center`}
                              title={match.teamA?.name}
                            >
                              {match.teamA?.shortName ?? match.teamA?.name}
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={scoreA}
                              onChange={(event) =>
                                setScoreA(event.target.value)
                              }
                              className={`${inputClass} min-w-0 text-center font-mono text-2xl! font-bold tabular-nums`}
                            />
                          </label>
                          <span className="pb-4 text-ink-faint">–</span>
                          <label className="min-w-0">
                            <span
                              className={`${labelClass} truncate text-center`}
                              title={match.teamB?.name}
                            >
                              {match.teamB?.shortName ?? match.teamB?.name}
                            </span>
                            <input
                              type="number"
                              min={0}
                              value={scoreB}
                              onChange={(event) =>
                                setScoreB(event.target.value)
                              }
                              className={`${inputClass} min-w-0 text-center font-mono text-2xl! font-bold tabular-nums`}
                            />
                          </label>
                        </div>
                        <label className="mt-4 block">
                          <span className={labelClass}>
                            {t("match.manage.resultStatus")}
                          </span>
                          <select
                            value={resultStatus}
                            onChange={(event) =>
                              setResultStatus(event.target.value as MatchStatus)
                            }
                            className={inputClass}
                          >
                            <option value="PENDING">
                              {t("match.status.PENDING")}
                            </option>
                            <option value="ONGOING">
                              {t("match.status.ONGOING")}
                            </option>
                            <option value="COMPLETED">
                              {t("match.status.COMPLETED")}
                            </option>
                          </select>
                        </label>
                        <div className="mt-5 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={saveAggregateResult}
                            disabled={Boolean(saving)}
                            className={`${resultButtonClass} grow`}
                          >
                            {saving === "result" && (
                              <CircleNotchIcon
                                aria-hidden="true"
                                className="motion-safe:animate-spin"
                              />
                            )}
                            {saving === "result"
                              ? t("common.saving")
                              : resultIsCorrection
                                ? t("match.manage.confirmCorrection")
                                : t("match.manage.saveResult")}
                          </button>
                          {drawAllowed && (
                            <button
                              type="button"
                              onClick={chooseDraw}
                              disabled={Boolean(saving)}
                              className={secondaryButtonClass}
                            >
                              {t("match.manage.setDraw")}
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </section>
                </fieldset>
              )}
            </div>
          ) : (
            <div className="p-6">
              <p role="alert" className={alertErrorClass}>
                {error || t("match.manage.notFound")}
              </p>
              <button
                type="button"
                className={`${secondaryButtonClass} mt-4`}
                onClick={() => {
                  setError("");
                  setLoading(true);
                  setRetryVersion((value) => value + 1);
                }}
              >
                {t("common.retry")}
              </button>
            </div>
          )}
        </div>
      </section>
    </div>,
    portalTarget,
  );
}
