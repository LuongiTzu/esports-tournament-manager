import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import { GeminiError, GeminiService } from './gemini.service';

function serviceWithConfig(values: Record<string, string>): GeminiService {
  const config = { get: (key: string) => values[key] } as ConfigService;
  return new GeminiService(config);
}

describe('GeminiService', () => {
  let warn: jest.SpyInstance;
  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });
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
    ).rejects.toMatchObject({ code: 'RATE_LIMITED', httpStatus: 429 });
  });

  it('retries a transient provider failure once and returns the actual reply', async () => {
    const request = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            candidates: [{ content: { parts: [{ text: 'Recovered' }] } }],
          }),
      } as Response);
    expect(
      await serviceWithConfig({ GEMINI_API_KEY: 'test-key' }).generateText(
        'question',
      ),
    ).toBe('Recovered');
    expect(request).toHaveBeenCalledTimes(2);
    expect(warn).not.toHaveBeenCalled();
  });

  it('stops after two transient failures and logs only safe diagnostics', async () => {
    const providerBody = jest
      .fn()
      .mockResolvedValue({ message: 'SECRET_PROVIDER_BODY' });
    const request = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: false,
      status: 503,
      json: providerBody,
    } as unknown as Response);
    await expect(
      serviceWithConfig({ GEMINI_API_KEY: 'SECRET_KEY' }).generateText(
        'PRIVATE_PROMPT',
      ),
    ).rejects.toEqual(new GeminiError('UNAVAILABLE', 503));
    expect(request).toHaveBeenCalledTimes(2);
    expect(providerBody).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledWith({
      event: 'gemini_request_failed',
      code: 'UNAVAILABLE',
      httpStatus: 503,
    });
  });

  it.each([
    [400, 'INVALID_REQUEST'],
    [404, 'INVALID_REQUEST'],
    [401, 'UNAUTHORIZED'],
    [403, 'UNAUTHORIZED'],
    [429, 'RATE_LIMITED'],
  ])('does not retry HTTP %s (%s)', async (status, code) => {
    const request = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: false, status } as Response);
    await expect(
      serviceWithConfig({ GEMINI_API_KEY: 'test-key' }).generateText(
        'question',
      ),
    ).rejects.toMatchObject({ code, httpStatus: status });
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('distinguishes a timeout from an unavailable connection after bounded retry', async () => {
    const request = jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new DOMException('private detail', 'TimeoutError'));
    await expect(
      serviceWithConfig({ GEMINI_API_KEY: 'test-key' }).generateText(
        'question',
      ),
    ).rejects.toMatchObject({ code: 'TIMEOUT' });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('retries connection failures without exposing their message', async () => {
    const request = jest
      .spyOn(global, 'fetch')
      .mockRejectedValue(new TypeError('network failed with SECRET_KEY'));
    await expect(
      serviceWithConfig({ GEMINI_API_KEY: 'SECRET_KEY' }).generateText(
        'question',
      ),
    ).rejects.toEqual(new GeminiError('UNAVAILABLE'));
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('does not retry or treat malformed JSON as a connection failure', async () => {
    const request = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: () => Promise.reject(new SyntaxError('invalid JSON')),
    } as Response);
    await expect(
      serviceWithConfig({ GEMINI_API_KEY: 'test-key' }).generateText(
        'question',
      ),
    ).rejects.toMatchObject({ code: 'INVALID_RESPONSE' });
    expect(request).toHaveBeenCalledTimes(1);
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
