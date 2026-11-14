import { ConfigService } from '@nestjs/config';
import { GeminiError, GeminiService } from './gemini.service';

function serviceWithConfig(values: Record<string, string>): GeminiService {
  const config = { get: (key: string) => values[key] } as ConfigService;
  return new GeminiService(config);
}

describe('GeminiService', () => {
  it('requires grounded citations before returning current information', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'Unsourced claim' }] } }],
        }),
    } as Response);
    expect(
      await serviceWithConfig({ GEMINI_API_KEY: 'test-key' }).researchEsports(
        'esports news',
      ),
    ).toBeNull();
  });

  it('uses Google Search and only exposes supported HTTPS citations', async () => {
    const request = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [
            {
              content: { parts: [{ text: 'Verified esports result' }] },
              groundingMetadata: {
                groundingChunks: [
                  {
                    web: {
                      uri: 'https://example.com/official',
                      title: 'Official event',
                    },
                  },
                  { web: { uri: 'javascript:alert(1)', title: 'Unsafe' } },
                  {
                    web: {
                      uri: 'https://example.com/unused',
                      title: 'Unused',
                    },
                  },
                ],
                groundingSupports: [{ groundingChunkIndices: [0, 1] }],
                searchEntryPoint: {
                  renderedContent: '<div>Google Search</div>',
                },
              },
            },
          ],
        }),
    } as Response);
    const result = await serviceWithConfig({
      GEMINI_API_KEY: 'test-key',
    }).researchEsports('esports result');
    expect(result?.sources).toEqual([
      { label: 'Official event', href: 'https://example.com/official' },
    ]);
    expect(result?.searchSuggestionsHtml).toBe('<div>Google Search</div>');
    const requestBody = request.mock.calls[0][1]?.body;
    if (typeof requestBody !== 'string') throw new Error('Expected JSON body');
    const body: unknown = JSON.parse(requestBody);
    expect(body).toMatchObject({ tools: [{ google_search: {} }] });
  });
  afterEach(() => jest.restoreAllMocks());

  it('requires a server-side API key before sending a request', async () => {
    const request = jest.spyOn(global, 'fetch');

    await expect(
      serviceWithConfig({}).generateText('hello'),
    ).rejects.toMatchObject({ code: 'NOT_CONFIGURED' });
    expect(request).not.toHaveBeenCalled();
  });

  it('sends the key in a header and returns generated text', async () => {
    const request = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          candidates: [{ content: { parts: [{ text: 'OK' }] } }],
        }),
    } as Response);

    const result = await serviceWithConfig({
      GEMINI_API_KEY: 'test-key',
    }).generateText('Reply OK');

    expect(result).toBe('OK');
    const [url, options] = request.mock.calls[0];
    expect(url).toContain('gemini-3.5-flash-lite:generateContent');
    expect(url).not.toContain('test-key');
    expect(options?.headers).toEqual({
      'Content-Type': 'application/json',
      'x-goog-api-key': 'test-key',
    });
    expect(options?.body).toBe(
      JSON.stringify({ contents: [{ parts: [{ text: 'Reply OK' }] }] }),
    );
  });

  it('reports quota errors without exposing provider response content', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 429,
    } as Response);

    await expect(
      serviceWithConfig({ GEMINI_API_KEY: 'test-key' }).generateText('hello'),
    ).rejects.toEqual(new GeminiError('RATE_LIMITED'));
  });

  it('rejects an empty model response', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ candidates: [] }),
    } as Response);

    await expect(
      serviceWithConfig({ GEMINI_API_KEY: 'test-key' }).generateText('hello'),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
  });
});
