import assert from "node:assert/strict";
import test from "node:test";
import { parseYouTubeUrl } from "../features/matches/youtube.ts";
import { parseYouTubeUrl as backendParse } from "../../backend/src/matches/domain/youtube-url.ts";

test("frontend and backend agree on accepted links and reject unsafe inputs", () => {
  const valid = [
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=share&t=30",
    " https://youtu.be/dQw4w9WgXcQ ",
    "https://youtube.com/live/dQw4w9WgXcQ",
    "https://m.youtube.com/watch?v=dQw4w9WgXcQ",
  ];
  const invalid = [
    "", "http://youtu.be/dQw4w9WgXcQ", "https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ",
    "https://youtube.com@evil.test/watch?v=dQw4w9WgXcQ", "https://user:password@youtube.com/watch?v=dQw4w9WgXcQ",
    "https://youtube.com:8443/watch?v=dQw4w9WgXcQ", "https://twitch.tv/channel",
    "https://youtube.com/@channel/live", "https://youtube.com/playlist?list=123",
    "https://youtube.com/watch?v=short", "https://youtube.com/watch?v=dQw4w9WgXcQ&v=abcdefghijk",
    "javascript:alert(1)", '<iframe src="https://youtube.com/embed/dQw4w9WgXcQ"></iframe>', "x".repeat(2049),
  ];
  for (const input of valid) {
    assert.deepEqual(parseYouTubeUrl(input), { videoId: "dQw4w9WgXcQ", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" });
  }
  for (const input of invalid) assert.equal(parseYouTubeUrl(input), null, input);
  for (const input of [...valid, ...invalid]) assert.deepEqual(parseYouTubeUrl(input), backendParse(input));
});
