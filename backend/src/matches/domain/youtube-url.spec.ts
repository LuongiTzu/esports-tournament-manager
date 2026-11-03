import { parseYouTubeUrl } from './youtube-url';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { UpdateMatchYouTubeDto } from '../dto/update-match-youtube.dto';

describe('YouTube URLs', () => {
  it.each([
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&si=share&t=30',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/live/dQw4w9WgXcQ?si=share',
    ' https://youtu.be/dQw4w9WgXcQ ',
  ])('normalizes %s', (input) => {
    expect(parseYouTubeUrl(input)).toEqual({
      videoId: 'dQw4w9WgXcQ',
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
  });
  it.each([
    'http://youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ',
    'https://youtube.com@evil.test/watch?v=dQw4w9WgXcQ',
    'https://evil.test@youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com:8443/watch?v=dQw4w9WgXcQ',
    'https://twitch.tv/channel',
    'https://youtube.com/@channel/live',
    'https://youtube.com/playlist?list=123',
    'https://youtube.com/watch?v=dQw4w9WgXcQ&v=abcdefghijk',
    'https://youtu.be/dQw4w9WgXcQ/other',
    'https://youtube.com/watch?v=short',
    'javascript:alert(1)',
    '<iframe src="https://youtube.com/embed/dQw4w9WgXcQ"></iframe>',
    '',
    'x'.repeat(2049),
  ])('rejects %s', (input) => expect(parseYouTubeUrl(input)).toBeNull());

  it('requires an explicit URL or null; a missing field must not delete the video', async () => {
    for (const body of [
      {},
      { youtubeUrl: undefined },
      { youtubeUrl: 42 },
      { youtubeUrl: [] },
    ]) {
      expect(
        await validate(plainToInstance(UpdateMatchYouTubeDto, body)),
      ).not.toHaveLength(0);
    }
    expect(
      await validate(
        plainToInstance(UpdateMatchYouTubeDto, { youtubeUrl: null }),
      ),
    ).toHaveLength(0);
  });
});
