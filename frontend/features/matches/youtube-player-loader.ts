export interface YouTubePlayer {
  destroy(): void;
}

interface YouTubeApi {
  Player: new (
    element: HTMLIFrameElement,
    options: { events: { onReady: () => void; onError: () => void } },
  ) => YouTubePlayer;
}

declare global {
  interface Window {
    YT?: YouTubeApi;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let pending: Promise<YouTubeApi> | null = null;

/** One script for editor previews and public players, with retry after a load failure. */
export function loadYouTubeApi(): Promise<YouTubeApi> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (pending) return pending;
  pending = new Promise<YouTubeApi>((resolve, reject) => {
    const script = document.createElement("script");
    const previousReady = window.onYouTubeIframeAPIReady;
    const cleanup = () => {
      window.clearTimeout(timeout);
      script.onerror = null;
      if (window.onYouTubeIframeAPIReady === ready) {
        window.onYouTubeIframeAPIReady = previousReady;
      }
    };
    const fail = () => {
      cleanup();
      script.remove();
      reject(new Error("YouTube API could not be loaded"));
    };
    const ready = () => {
      cleanup();
      if (window.YT?.Player) resolve(window.YT);
      else fail();
      previousReady?.();
    };
    const timeout = window.setTimeout(fail, 15_000);
    window.onYouTubeIframeAPIReady = ready;
    script.src = "https://www.youtube.com/iframe_api";
    script.async = true;
    script.onerror = fail;
    document.head.appendChild(script);
  }).catch((error: unknown) => {
    pending = null;
    throw error;
  });
  return pending;
}
