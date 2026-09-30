"use client";

import { useState } from "react";
import {
  CircleNotchIcon,
  GavelIcon,
  LinkSimpleIcon,
} from "@phosphor-icons/react";
import { inputClass, labelClass, primaryButtonClass } from "@/components/ui";
import { useLocale } from "@/features/locale/store";
import type { MatchResultReview } from "@/features/matches/types";
import type { BracketTeam } from "@/features/tournaments/types";

interface Props {
  review: MatchResultReview | null;
  teamA: BracketTeam | null;
  teamB: BracketTeam | null;
  working: boolean;
  onResolve: (resolutionNote: string) => Promise<boolean>;
}

const statusTone = {
  PENDING_CONFIRMATION: "border-pending/30 bg-pending/10 text-pending",
  CONFIRMED: "border-approved/30 bg-approved/10 text-approved",
  DISPUTED: "border-rejected/30 bg-rejected/10 text-rejected",
  RESOLVED: "border-brand/30 bg-brand/10 text-brand",
} as const;

export default function MatchResultReviewManagement({
  review,
  teamA,
  teamB,
  working,
  onResolve,
}: Props) {
  const { t } = useLocale();
  const [resolutionNote, setResolutionNote] = useState("");
  const [invalid, setInvalid] = useState(false);
  if (!review) return null;

  const resolve = async () => {
    const note = resolutionNote.trim();
    if (note.length < 10) {
      setInvalid(true);
      return;
    }
    setInvalid(false);
    if (await onResolve(note)) setResolutionNote("");
  };

  return (
    <section className="rounded-xl border border-line p-4 sm:p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 text-sm font-bold text-ink">
            <GavelIcon size={18} className="text-brand-hover" />
            {t("match.manage.review.title")}
          </h3>
          <p className="mt-2 text-xs leading-5 text-ink-muted">
            {t("match.manage.review.description")}
          </p>
        </div>
        <span
          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${statusTone[review.status]}`}
        >
          {t(`myMatches.resultReview.status.${review.status}`)}
        </span>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {[teamA, teamB]
          .filter((team): team is BracketTeam => Boolean(team))
          .map((team) => {
            const response = review.responses.find(
              (item) => item.teamId === team.id,
            );
            return (
              <article key={team.id} className="rounded-lg bg-surface-sub p-3">
                <p className="text-xs font-bold text-ink">{team.name}</p>
                <p className="mt-1 text-xs font-semibold text-ink-muted">
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
              </article>
            );
          })}
      </div>

      {review.status === "DISPUTED" && (
        <div className="mt-4 rounded-lg border border-rejected/25 bg-rejected/5 p-3">
          <p className="text-xs leading-5 text-ink-muted">
            {t("match.manage.review.correctionHint")}
          </p>
          <label className="mt-3 block">
            <span className={labelClass}>
              {t("match.manage.review.resolutionNote")}
            </span>
            <textarea
              rows={3}
              maxLength={2000}
              value={resolutionNote}
              onChange={(event) => setResolutionNote(event.target.value)}
              className={`${inputClass} resize-y`}
            />
          </label>
          {invalid && (
            <p className="mt-2 text-xs font-semibold text-rejected">
              {t("match.manage.review.validation")}
            </p>
          )}
          <button
            type="button"
            disabled={working}
            onClick={resolve}
            className={`${primaryButtonClass} mt-3 bg-none! bg-brand shadow-none!`}
          >
            {working && <CircleNotchIcon className="animate-spin" />}
            {t("match.manage.review.uphold")}
          </button>
        </div>
      )}

      {review.status === "RESOLVED" && review.resolutionNote && (
        <p className="mt-4 rounded-lg border border-brand/20 bg-brand/5 px-3 py-2 text-xs leading-5 text-ink-muted">
          <strong className="text-ink">
            {t("myMatches.resultReview.resolution")}:
          </strong>{" "}
          {review.resolutionNote}
          {review.resolvedBy && (
            <span className="block text-ink-faint">
              {t("match.manage.review.resolvedBy")}{" "}
              {review.resolvedBy.displayName}
            </span>
          )}
        </p>
      )}
    </section>
  );
}
