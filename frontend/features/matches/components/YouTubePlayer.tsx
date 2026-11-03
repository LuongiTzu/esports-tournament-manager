"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowSquareOutIcon,
  CircleNotchIcon,
  PlayIcon,
  YoutubeLogoIcon,
} from "@phosphor-icons/react";
import ResolvedImage from "@/components/ResolvedImage";
import { useLocale } from "@/features/locale/store";
import { parseYouTubeUrl } from "../youtube";
import {
  loadYouTubeApi,
  type YouTubePlayer as Player,
} from "../youtube-player-loader";
import styles from "./YouTubePlayer.module.css";

export default function YouTubePlayer({ url }: { url: string }) {
  const { t } = useLocale();
  const video = parseYouTubeUrl(url);
  if (!video)
    return <p role="alert" className={styles.invalid}>{t("youtube.invalid")}</p>;
  return (
    <VideoPlayer key={video.videoId} videoId={video.videoId} url={video.url} />
  );
}

function VideoPlayer({ videoId, url }: { videoId: string; url: string }) {
  const { t } = useLocale();
  const [attempt, setAttempt] = useState(0);
  return (
    <div className={styles.root}>
      {attempt === 0 ? (
        <button
          type="button"
          onClick={() => setAttempt(1)}
          className={styles.preview}
          aria-label={t("youtube.watch")}
        >
          <span className={styles.posterFallback} aria-hidden="true">
            <YoutubeLogoIcon size={96} weight="fill" />
          </span>
          <ResolvedImage
            src={`https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`}
            fallbackSrc={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
            alt=""
            className={styles.poster}
            loading="eager"
          />
          <span className={styles.scrim} aria-hidden="true" />
          <span className={styles.brand} aria-hidden="true">
            <YoutubeLogoIcon size={18} /> YouTube
          </span>
          <span className={styles.previewAction} aria-hidden="true">
            <span className={styles.playCircle}>
              <PlayIcon size={28} weight="fill" />
            </span>
            <span>{t("youtube.watch")}</span>
          </span>
        </button>
      ) : (
        <ActivePlayer
          key={attempt}
          videoId={videoId}
          onRetry={() => setAttempt((value) => value + 1)}
        />
      )}
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={styles.externalLink}
      >
        {t("youtube.open")}
        <ArrowSquareOutIcon size={18} aria-hidden="true" />
      </a>
    </div>
  );
}

function ActivePlayer({
  videoId,
  onRetry,
}: {
  videoId: string;
  onRetry: () => void;
}) {
  const { t } = useLocale();
  const host = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const title = t("youtube.title");

  useEffect(() => {
    let cancelled = false;
    let player: Player | undefined;
    const container = host.current;
    if (!container) return;
    const timeout = window.setTimeout(() => {
      if (!cancelled) setStatus("error");
    }, 20_000);
    loadYouTubeApi()
      .then((api) => {
        if (cancelled) return;
        const frame = document.createElement("iframe");
        const query = new URLSearchParams({
          enablejsapi: "1",
          origin: window.location.origin,
          playsinline: "1",
          autoplay: "1",
        });
        frame.src = `https://www.youtube.com/embed/${videoId}?${query}`;
        frame.title = title;
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
        frame.allowFullscreen = true;
        frame.className = "absolute inset-0 h-full w-full border-0";
        container.appendChild(frame);
        player = new api.Player(frame, {
          events: {
            onReady: () => {
              window.clearTimeout(timeout);
              if (!cancelled) setStatus("ready");
            },
            onError: () => {
              window.clearTimeout(timeout);
              if (!cancelled) setStatus("error");
            },
          },
        });
      })
      .catch(() => {
        window.clearTimeout(timeout);
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      player?.destroy();
      container.replaceChildren();
    };
  }, [videoId, title]);

  return (
    <div className={styles.playerFrame}>
      <div ref={host} className={styles.playerHost} />
      {status === "loading" && (
        <div className={styles.playerOverlay} role="status">
          <CircleNotchIcon size={28} className={styles.spinner} aria-hidden="true" />
          <span>{t("youtube.loading")}</span>
        </div>
      )}
      {status === "error" && (
        <div className={styles.playerOverlay}>
          <p role="alert" className={styles.playerError}>
            {t("youtube.playError")}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className={styles.retry}
          >
            {t("common.retry")}
          </button>
        </div>
      )}
    </div>
  );
}
