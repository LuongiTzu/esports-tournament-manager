"use client";

import { useEffect, useRef, useState } from "react";
import {
  CalendarPlusIcon,
  CheckIcon,
  CircleNotchIcon,
  CopyIcon,
  DownloadSimpleIcon,
  QrCodeIcon,
  XIcon,
} from "@phosphor-icons/react";
import { QRCodeCanvas } from "qrcode.react";
import { secondaryButtonClass } from "@/components/ui";
import { useLocale } from "@/features/locale/store";
import { tournamentsApi } from "@/features/tournaments/api";
import {
  createTournamentCalendar,
  downloadCalendar,
} from "@/features/tournaments/calendar";
import type { TournamentDetail } from "@/features/tournaments/types";
import { absoluteSiteUrl } from "@/lib/site-url";

type Feedback = { tone: "success" | "error"; message: string } | null;

function safeFileName(value: string) {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return `${normalized || "tournament"}-qr.png`;
}

export default function TournamentShareActions({
  tournament,
}: {
  tournament: TournamentDetail;
}) {
  const { t } = useLocale();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const qrRef = useRef<HTMLCanvasElement>(null);
  const shareUrl = absoluteSiteUrl(
    `/tournaments/${encodeURIComponent(tournament.slug)}`,
  );
  const [calendarLoading, setCalendarLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(null), 3600);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const openShareDialog = () => {
    setCopied(false);
    dialogRef.current?.showModal();
  };

  const closeShareDialog = () => dialogRef.current?.close();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setFeedback({ tone: "error", message: t("tournament.tools.copyError") });
    }
  };

  const downloadQr = () => {
    const dataUrl = qrRef.current?.toDataURL("image/png");
    if (!dataUrl) return;
    const anchor = document.createElement("a");
    anchor.href = dataUrl;
    anchor.download = safeFileName(tournament.name);
    anchor.click();
  };

  const exportCalendar = async () => {
    if (calendarLoading) return;
    setCalendarLoading(true);
    setFeedback(null);
    try {
      const schedule = await tournamentsApi.getSchedule(tournament.slug);
      const calendar = createTournamentCalendar({
        schedule,
        pageUrl: shareUrl,
        location:
          tournament.location ?? t(`tournament.mode.${tournament.mode}`),
        copy: {
          awaitingTeam: t("match.awaitingTeam"),
          bestOf: t("round.settings.bestOf"),
          round: t("competition.stage"),
          versus: t("tournament.tools.versus"),
        },
      });
      if (calendar.eventCount === 0) {
        setFeedback({
          tone: "error",
          message: t("tournament.tools.noScheduledMatches"),
        });
        return;
      }
      downloadCalendar(calendar.content, calendar.fileName);
      setFeedback({
        tone: "success",
        message: t("tournament.tools.calendarDownloaded"),
      });
    } catch (reason) {
      setFeedback({
        tone: "error",
        message:
          reason instanceof Error
            ? reason.message
            : t("tournament.tools.calendarError"),
      });
    } finally {
      setCalendarLoading(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => void exportCalendar()}
        disabled={calendarLoading}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface-card/90 px-3.5 text-sm font-semibold text-ink-muted shadow-sm backdrop-blur-md transition hover:border-accent/45 hover:text-accent disabled:cursor-wait disabled:opacity-60"
      >
        {calendarLoading ? (
          <CircleNotchIcon className="animate-spin" aria-hidden />
        ) : (
          <CalendarPlusIcon aria-hidden />
        )}
        {t("tournament.tools.exportCalendar")}
      </button>

      {tournament.visibility === "PUBLIC" && (
        <button
          type="button"
          onClick={openShareDialog}
          aria-haspopup="dialog"
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface-card/90 px-3.5 text-sm font-semibold text-ink-muted shadow-sm backdrop-blur-md transition hover:border-accent/45 hover:text-accent"
        >
          <QrCodeIcon aria-hidden />
          {t("tournament.tools.share")}
        </button>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby="tournament-share-title"
        aria-describedby="tournament-share-description"
        onCancel={(event) => {
          event.preventDefault();
          closeShareDialog();
        }}
        className="m-auto w-[min(94vw,32rem)] rounded-xl border border-line bg-surface-elevated p-0 text-ink shadow-[var(--shadow-elevated)] backdrop:bg-overlay"
      >
        <div className="relative flex min-h-16 items-center justify-center border-b border-line px-16 py-4">
          <h2 id="tournament-share-title" className="text-xl font-black">
            {t("tournament.tools.shareTitle")}
          </h2>
          <button
            type="button"
            aria-label={t("common.close")}
            onClick={closeShareDialog}
            className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full bg-surface-sub text-ink-muted transition hover:bg-surface-hover hover:text-ink"
          >
            <XIcon size={22} weight="bold" aria-hidden />
          </button>
        </div>

        <div className="p-5 text-center sm:p-6">
          <p
            id="tournament-share-description"
            className="text-sm leading-6 text-ink-muted"
          >
            {t("tournament.tools.shareDescription")}
          </p>
          <div className="mx-auto mt-5 w-fit rounded-xl bg-white p-3 shadow-sm">
            {shareUrl && (
              <QRCodeCanvas
                ref={qrRef}
                value={shareUrl}
                size={240}
                level="M"
                marginSize={2}
                title={`${t("tournament.tools.qrAlt")} ${tournament.name}`}
              />
            )}
          </div>
          <p className="mt-4 truncate rounded-lg border border-line bg-surface-sub px-3 py-2 text-left text-xs text-ink-muted">
            {shareUrl}
          </p>
          <div className="mt-5 grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => void copyLink()}
              className={secondaryButtonClass}
            >
              {copied ? (
                <CheckIcon weight="bold" aria-hidden />
              ) : (
                <CopyIcon aria-hidden />
              )}
              {copied
                ? t("tournament.tools.copied")
                : t("tournament.tools.copyLink")}
            </button>
            <button
              type="button"
              onClick={downloadQr}
              className={secondaryButtonClass}
            >
              <DownloadSimpleIcon aria-hidden />
              {t("tournament.tools.downloadQr")}
            </button>
          </div>
        </div>
      </dialog>

      {feedback && (
        <div
          role={feedback.tone === "error" ? "alert" : "status"}
          className={`fixed bottom-5 left-4 right-4 z-[210] rounded-xl border bg-surface-elevated px-4 py-3 text-sm shadow-[var(--shadow-elevated)] sm:left-auto sm:right-5 sm:max-w-sm ${
            feedback.tone === "error"
              ? "border-rejected/35 text-rejected"
              : "border-approved/35 text-approved"
          }`}
        >
          {feedback.message}
        </div>
      )}
    </>
  );
}
