const youtubeHosts = new Set([
  'youtube.com',
  'www.youtube.com',
  'm.youtube.com',
]);

/** Accept a video URL, never arbitrary embed markup or a channel URL. */
export function parseYouTubeUrl(
  value: string,
): { videoId: string; url: string } | null {
  if (value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password || url.port)
      return null;
    let videoId: string | null = null;
    if (url.hostname === 'youtu.be') {
      videoId = /^\/([\w-]{11})\/?$/.exec(url.pathname)?.[1] ?? null;
    } else if (youtubeHosts.has(url.hostname)) {
      if (
        url.pathname === '/watch' &&
        url.searchParams.getAll('v').length === 1
      ) {
        videoId = url.searchParams.get('v');
      } else {
        videoId = /^\/live\/([\w-]{11})\/?$/.exec(url.pathname)?.[1] ?? null;
      }
    }
    if (!videoId || !/^[\w-]{11}$/.test(videoId)) return null;
    return { videoId, url: `https://www.youtube.com/watch?v=${videoId}` };
  } catch {
    return null;
  }
}
