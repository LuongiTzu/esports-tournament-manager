"use client";

import { useEffect, useRef, useState } from "react";
import { PlayCircleIcon, ArrowSquareOutIcon } from "@phosphor-icons/react";
import { secondaryButtonClass } from "@/components/ui";
import { useLocale } from "@/features/locale/store";
import { parseYouTubeUrl } from "../youtube";
import {
  loadYouTubeApi,
  type YouTubePlayer as Player,
} from "../youtube-player-loader";

export default function YouTubePlayer({ url }: { url: string }) {
  const { t } = useLocale();
  const video = parseYouTubeUrl(url);
  if (!video) return <p role="alert">{t("youtube.invalid")}</p>;
  return (
    <VideoPlayer key={video.videoId} videoId={video.videoId} url={video.url} />
  );
}

function VideoPlayer({ videoId, url }: { videoId: string; url: string }) {
  const { t } = useLocale();
  const [attempt, setAttempt] = useState(0);
  return (
    <div className="space-y-3">
      {attempt === 0 ? (
        <div className="grid aspect-video min-h-[200px] place-items-center rounded-xl border border-line bg-surface-sub p-5">
          <button
            type="button"
            onClick={() => setAttempt(1)}
            className={secondaryButtonClass}
          >
            <PlayCircleIcon size={24} aria-hidden="true" /> {t("youtube.watch")}
          </button>
        </div>
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
        className="inline-flex items-center gap-2 text-sm font-semibold text-brand hover:underline"
      >
        <ArrowSquareOutIcon aria-hidden="true" /> {t("youtube.open")}
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
          autoplay: "0",
        });
        frame.src = `https://www.youtube.com/embed/${videoId}?${query}`;
        frame.title = title;
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        frame.allow = "encrypted-media; picture-in-picture; fullscreen";
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
    <div>
      <div
        ref={host}
        className="relative aspect-video min-h-[200px] overflow-hidden rounded-xl bg-black"
      />
      {status === "loading" && (
        <p role="status" className="mt-2 text-sm text-ink-muted">
          {t("youtube.loading")}
        </p>
      )}
      {status === "error" && (
        <div className="mt-3 space-y-2">
          <p role="alert" className="text-sm text-rejected">
            {t("youtube.playError")}
          </p>
          <button
            type="button"
            onClick={onRetry}
            className={secondaryButtonClass}
          >
            {t("common.retry")}
          </button>
        </div>
      )}
    </div>
  );
}
