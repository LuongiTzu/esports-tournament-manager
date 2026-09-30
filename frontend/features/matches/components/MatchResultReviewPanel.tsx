"use client";

import { useState } from "react";
import {
  CheckCircleIcon,
  CircleNotchIcon,
  LinkSimpleIcon,
  WarningCircleIcon,
} from "@phosphor-icons/react";
import { inputClass, labelClass } from "@/components/ui";
import { useLocale } from "@/features/locale/store";
import type {
  MyMatch,
  RespondToMatchResultRequest,
} from "@/features/matches/types";

interface Props {
  match: MyMatch;
  working: boolean;
  feedback: "success" | "error" | null;
  onRespond: (data: RespondToMatchResultRequest) => Promise<boolean>;
}

const statusTone = {
  PENDING_CONFIRMATION: "border-pending/30 bg-pending/10 text-pending",
  CONFIRMED: "border-approved/30 bg-approved/10 text-approved",
  DISPUTED: "border-rejected/30 bg-rejected/10 text-rejected",
  RESOLVED: "border-brand/30 bg-brand/10 text-brand",
} as const;

export default function MatchResultReviewPanel({
  match,
  working,
  feedback,
  onRespond,
}: Props) {
  const { t } = useLocale();
  const [showDispute, setShowDispute] = useState(false);
  const [note, setNote] = useState("");
  const [evidence, setEvidence] = useState("");
  const [validationError, setValidationError] = useState(false);
  const review = match.resultReview;
  if (match.status !== "COMPLETED" || !review) return null;

  const captainTeamId = match.captainTeamIds.find((teamId) =>
    match.userTeamIds.includes(teamId),
  );
  const ownResponse = captainTeamId
    ? review.responses.find((response) => response.teamId === captainTeamId)
    : undefined;
  const finalized =
    review.status === "CONFIRMED" || review.status === "RESOLVED";
  const teams = [match.teamA, match.teamB].filter(
    (team): team is NonNullable<typeof team> => Boolean(team),
  );

  const submitConfirmation = async () => {
    if (!captainTeamId || working) return;
    setValidationError(false);
    await onRespond({ teamId: captainTeamId, decision: "CONFIRMED" });
  };

  const submitDispute = async () => {
    if (!captainTeamId || working) return;
    const trimmedNote = note.trim();
    const evidenceUrls = evidence
      .split(/\r?\n/)
      .map((value) => value.trim())
      .filter(Boolean);
    const urlsAreValid = evidenceUrls.every((value) => {
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    });
    if (trimmedNote.length < 10 || evidenceUrls.length > 5 || !urlsAreValid) {
      setValidationError(true);
      return;
    }
    setValidationError(false);
    if (
      await onRespond({
        teamId: captainTeamId,
        decision: "DISPUTED",
        note: trimmedNote,
        evidenceUrls,
      })
    ) {
      setShowDispute(false);
    }
  };

  return (
    <section className="mt-4 rounded-xl border border-line bg-surface-sub/45 p-3.5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h3 className="text-sm font-bold text-ink">
            {t("myMatches.resultReview.title")}
          </h3>
          <p className="mt-1 text-xs leading-5 text-ink-muted">
            {t("myMatches.resultReview.description")}
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusTone[review.status]}`}
        >
          {t(`myMatches.resultReview.status.${review.status}`)}
        </span>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {teams.map((team) => {
          const response = review.responses.find(
            (item) => item.teamId === team.id,
          );
          return (
            <div
              key={team.id}
              className="rounded-lg border border-line bg-surface-card p-3"
            >
              <p className="truncate text-xs font-bold text-ink">{team.name}</p>
              <p
                className={`mt-1 text-xs font-semibold ${
                  response?.decision === "CONFIRMED"
                    ? "text-approved"
                    : response?.decision === "DISPUTED"
                      ? "text-rejected"
                      : "text-ink-muted"
                }`}
              >
                {response
                  ? t(`myMatches.resultReview.decision.${response.decision}`)
                  : t("myMatches.resultReview.awaiting")}
              </p>
              {response?.note && (
                <p className="mt-2 whitespace-pre-wrap break-words text-xs leading-5 text-ink-muted">
                  {response.note}
                </p>
              )}
              {response && response.evidenceUrls.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {response.evidenceUrls.map((url, index) => (
                    <a
                      key={`${url}-${index}`}
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
                    >
                      <LinkSimpleIcon aria-hidden />
                      {t("myMatches.resultReview.evidence")} {index + 1}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {review.status === "RESOLVED" && review.resolutionNote && (
        <p className="mt-3 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-xs leading-5 text-ink-muted">
          <strong className="text-ink">
            {t("myMatches.resultReview.resolution")}:
          </strong>{" "}
          {review.resolutionNote}
        </p>
      )}

      {!captainTeamId ? (
        <p className="mt-3 text-xs font-semibold text-ink-muted">
          {t("myMatches.resultReview.captainOnly")}
        </p>
      ) : ownResponse ? (
        <p className="mt-3 inline-flex items-center gap-1.5 text-xs font-bold text-approved">
          <CheckCircleIcon weight="fill" />
          {t("myMatches.resultReview.responded")}
        </p>
      ) : !finalized && review.status !== "DISPUTED" ? (
        <div className="mt-3">
          {!showDispute ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={working}
                onClick={submitConfirmation}
                className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-approved px-4 py-2 text-xs font-bold text-white transition disabled:opacity-60"
              >
                {working && <CircleNotchIcon className="animate-spin" />}
                {t("myMatches.resultReview.confirm")}
              </button>
              <button
                type="button"
                disabled={working}
                onClick={() => setShowDispute(true)}
                className="inline-flex min-h-10 items-center justify-center rounded-lg border border-rejected/35 px-4 py-2 text-xs font-bold text-rejected transition hover:bg-rejected/10 disabled:opacity-60"
              >
                {t("myMatches.resultReview.dispute")}
              </button>
            </div>
          ) : (
            <div className="grid gap-3">
              <label>
                <span className={labelClass}>
                  {t("myMatches.resultReview.disputeReason")}
                </span>
                <textarea
                  value={note}
                  maxLength={2000}
                  rows={3}
                  onChange={(event) => setNote(event.target.value)}
                  className={`${inputClass} resize-y`}
                />
              </label>
              <label>
                <span className={labelClass}>
                  {t("myMatches.resultReview.evidenceLinks")}
                </span>
                <textarea
                  value={evidence}
                  rows={2}
                  onChange={(event) => setEvidence(event.target.value)}
                  placeholder="https://..."
                  className={`${inputClass} resize-y`}
                />
              </label>
              {(validationError || feedback === "error") && (
                <p className="flex items-start gap-1.5 text-xs font-semibold text-rejected">
                  <WarningCircleIcon className="mt-0.5 shrink-0" />
                  {t(
                    validationError
                      ? "myMatches.resultReview.validation"
                      : "myMatches.resultReview.error",
                  )}
                </p>
              )}
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={working}
                  onClick={submitDispute}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-rejected px-4 py-2 text-xs font-bold text-white disabled:opacity-60"
                >
                  {working && <CircleNotchIcon className="animate-spin" />}
                  {t("myMatches.resultReview.submitDispute")}
                </button>
                <button
                  type="button"
                  disabled={working}
                  onClick={() => setShowDispute(false)}
                  className="min-h-10 rounded-lg border border-line px-4 py-2 text-xs font-semibold text-ink"
                >
                  {t("common.cancel")}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : null}

      {feedback === "success" && (
        <p className="mt-3 text-xs font-bold text-approved" role="status">
          {t("myMatches.resultReview.success")}
        </p>
      )}
      {feedback === "error" && !showDispute && (
        <p className="mt-3 text-xs font-bold text-rejected" role="alert">
          {t("myMatches.resultReview.error")}
        </p>
      )}
    </section>
  );
}
