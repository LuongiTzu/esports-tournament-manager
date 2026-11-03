"use client";

import { useEffect, useId, useRef } from "react";
import { YoutubeLogoIcon, XIcon } from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import type { BracketMatch } from "@/features/tournaments/types";
import { useLocale } from "@/features/locale/store";
import { formatLocalizedDate } from "@/features/locale/format";
import YouTubePlayer from "./YouTubePlayer";
import styles from "./PublicMatchDialog.module.css";

export default function PublicMatchDialog({
  match,
  onClose,
}: {
  match: BracketMatch;
  onClose: () => void;
}) {
  const { t, locale } = useLocale();
  const id = useId();
  const ref = useRef<HTMLDialogElement>(null);
  const teamA = match.slots.A;
  const teamB = match.slots.B;
  useEffect(() => {
    const dialog = ref.current;
    const focused = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      if (focused instanceof HTMLElement) focused.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      aria-labelledby={id}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className={styles.dialog}
    >
      <header className={styles.header}>
        <div>
          {match.youtubeUrl && (
            <p className={styles.eyebrow}>
              <YoutubeLogoIcon size={16} aria-hidden="true" />
              {t("youtube.matchVideo")}
            </p>
          )}
          <h2 id={id} className={styles.title}>
            {t("match.details")}
          </h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("common.close")}
          className={styles.close}
        >
          <XIcon size={20} aria-hidden="true" />
        </button>
      </header>
      <div className={styles.matchup}>
        <div
          className={styles.team}
          data-side="A"
          data-winner={Boolean(teamA && match.winner?.id === teamA.id)}
        >
          <span className={styles.teamLogo}>
            <ResolvedImage
              src={teamA?.logoUrl}
              alt=""
              className={styles.logoImage}
              fallback={teamA?.name.charAt(0) ?? "?"}
            />
          </span>
          <span className={styles.teamName}>
            {teamA?.name ?? t("match.awaitingTeam")}
          </span>
        </div>
        <p className={styles.score}>
          {match.status === "PENDING"
            ? "VS"
            : `${match.score.A} – ${match.score.B}`}
        </p>
        <div
          className={styles.team}
          data-side="B"
          data-winner={Boolean(teamB && match.winner?.id === teamB.id)}
        >
          <span className={styles.teamLogo}>
            <ResolvedImage
              src={teamB?.logoUrl}
              alt=""
              className={styles.logoImage}
              fallback={teamB?.name.charAt(0) ?? "?"}
            />
          </span>
          <span className={styles.teamName}>
            {teamB?.name ?? t("match.awaitingTeam")}
          </span>
        </div>
      </div>
      <div className={styles.meta}>
        <span className={styles.status} data-status={match.status}>
          {t(`match.status.${match.status}`)}
        </span>
        <span>BO{match.bestOf}</span>
        <span>
          {match.scheduledAt
            ? formatLocalizedDate(match.scheduledAt, locale, {
                dateStyle: "medium",
                timeStyle: "short",
              })
            : t("match.manage.unscheduled")}
        </span>
      </div>
      <div className={styles.media}>
        {match.youtubeUrl ? (
          <YouTubePlayer url={match.youtubeUrl} />
        ) : (
          <p className={styles.empty}>
            <YoutubeLogoIcon size={28} aria-hidden="true" />
            {t("youtube.empty")}
          </p>
        )}
      </div>
    </dialog>
  );
}
