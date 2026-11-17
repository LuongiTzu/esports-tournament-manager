import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const REQUEST_TIMEOUT_MS = 15_000;

export type GeminiErrorCode =
  | 'NOT_CONFIGURED'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'TIMEOUT'
  | 'INVALID_REQUEST'
  | 'UNAVAILABLE'
  | 'INVALID_RESPONSE';

export class GeminiError extends Error {
  constructor(
    readonly code: GeminiErrorCode,
    readonly httpStatus?: number,
  ) {
    super(`Gemini request failed: ${code}`);
    this.name = 'GeminiError';
  }
}

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  constructor(private readonly config: ConfigService) {}

  get model(): string {
    return this.config.get<string>('GEMINI_MODEL')?.trim() || DEFAULT_MODEL;
  }

  async generateText(
    prompt: string,
    schema?: Record<string, unknown>,
  ): Promise<string> {
    const body = await this.generate(
      prompt,
      schema
        ? {
            generationConfig: {
              responseMimeType: 'application/json',
              responseJsonSchema: schema,
              maxOutputTokens: 4096,
            },
          }
        : {},
    );
    const text = extractText(body);
    if (!text) {
      const error = new GeminiError('INVALID_RESPONSE');
      this.logFailure(error);
      throw error;
    }
    return text;
  }

  async researchEsports(prompt: string) {
    const body = await this.generate(
      prompt,
      {
        tools: [{ google_search: {} }],
        generationConfig: { maxOutputTokens: 2048 },
      },
      30_000,
    );
    const message = extractText(body);
    if (!message || !isRecord(body) || !Array.isArray(body.candidates))
      return null;
    const candidate: unknown = body.candidates[0];
    if (!isRecord(candidate) || !isRecord(candidate.groundingMetadata))
      return null;
    const metadata = candidate.groundingMetadata;
    if (
      !Array.isArray(metadata.groundingChunks) ||
      !Array.isArray(metadata.groundingSupports)
    )
      return null;
    const indices = new Set<number>();
    for (const support of metadata.groundingSupports) {
      if (isRecord(support) && Array.isArray(support.groundingChunkIndices)) {
        for (const index of support.groundingChunkIndices)
          if (
            typeof index === 'number' &&
            Number.isInteger(index) &&
            index >= 0
          )
            indices.add(index);
      }
    }
    const sources: { label: string; href: string }[] = [];
    for (const index of indices) {
      const chunk: unknown = metadata.groundingChunks[index];
      if (
        !isRecord(chunk) ||
        !isRecord(chunk.web) ||
        typeof chunk.web.uri !== 'string' ||
        typeof chunk.web.title !== 'string'
      )
        continue;
      try {
        const url = new URL(chunk.web.uri);
        if (url.protocol !== 'https:' || url.username || url.password) continue;
        if (!sources.some((s) => s.href === url.href))
          sources.push({
            label: chunk.web.title.slice(0, 200),
            href: url.href,
          });
      } catch {
        /* Invalid provider citation is not rendered. */
      }
    }
    if (!sources.length) return null;
    const entry = metadata.searchEntryPoint;
    return {
      message,
      sources,
      checkedAt: new Date().toISOString(),
      searchSuggestionsHtml:
        isRecord(entry) && typeof entry.renderedContent === 'string'
          ? entry.renderedContent
          : undefined,
    };
  }

  private async generate(
    prompt: string,
    options: Record<string, unknown>,
    timeout = REQUEST_TIMEOUT_MS,
  ): Promise<unknown> {
    const apiKey = this.config.get<string>('GEMINI_API_KEY')?.trim();
    if (!apiKey) throw new GeminiError('NOT_CONFIGURED');

    // These requests generate text/preview data only; they never execute mutations.
    // Retry once for transport timeouts or transient upstream failures, not quota/auth/schema errors.
    for (let attempt = 0; ; attempt++) {
      const signal = AbortSignal.timeout(timeout);
      try {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-goog-api-key': apiKey,
            },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              ...options,
            }),
            signal,
          },
        );
        if (!response.ok) {
          const code: GeminiErrorCode =
            response.status === 401 || response.status === 403
              ? 'UNAUTHORIZED'
              : response.status === 429
                ? 'RATE_LIMITED'
                : response.status >= 400 && response.status < 500
                  ? 'INVALID_REQUEST'
                  : 'UNAVAILABLE';
          throw new GeminiError(code, response.status);
        }
        try {
          return (await response.json()) as unknown;
        } catch {
          throw new GeminiError(
            signal.aborted ? 'TIMEOUT' : 'INVALID_RESPONSE',
          );
        }
      } catch (error) {
        const failure =
          error instanceof GeminiError
            ? error
            : new GeminiError(
                signal.aborted ||
                  (isRecord(error) && error.name === 'TimeoutError')
                  ? 'TIMEOUT'
                  : 'UNAVAILABLE',
              );
        const transient =
          failure.code === 'TIMEOUT' ||
          (failure.code === 'UNAVAILABLE' &&
            (failure.httpStatus === undefined || failure.httpStatus >= 500));
        if (attempt === 0 && transient) {
          await new Promise((resolve) => setTimeout(resolve, 300));
          continue;
        }
        this.logFailure(failure);
        throw failure;
      }
    }
  }

  private logFailure(error: GeminiError) {
    // Never log prompts, API keys or raw provider response bodies.
    this.logger.warn({
      event: 'gemini_request_failed',
      code: error.code,
      httpStatus: error.httpStatus,
    });
  }
}

function extractText(body: unknown): string | null {
  if (!isRecord(body) || !Array.isArray(body.candidates)) return null;
  const candidate: unknown = body.candidates[0];
  if (!isRecord(candidate) || !isRecord(candidate.content)) return null;
  const parts = candidate.content.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts
    .filter(isRecord)
    .filter((part) => part.thought !== true)
    .map((part) => part.text)
    .filter((part): part is string => typeof part === 'string')
    .join('')
    .trim();
  return text || null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
