import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const DEFAULT_MODEL = 'gemini-3.5-flash-lite';
const REQUEST_TIMEOUT_MS = 15_000;

export type GeminiErrorCode =
  | 'NOT_CONFIGURED'
  | 'UNAUTHORIZED'
  | 'RATE_LIMITED'
  | 'UNAVAILABLE'
  | 'INVALID_RESPONSE';

export class GeminiError extends Error {
  constructor(readonly code: GeminiErrorCode) {
    super(`Gemini request failed: ${code}`);
    this.name = 'GeminiError';
  }
}

@Injectable()
export class GeminiService {
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
    if (!text) throw new GeminiError('INVALID_RESPONSE');
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

    let response: Response;
    try {
      response = await fetch(
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
          signal: AbortSignal.timeout(timeout),
        },
      );
    } catch {
      throw new GeminiError('UNAVAILABLE');
    }

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        throw new GeminiError('UNAUTHORIZED');
      }
      if (response.status === 429) throw new GeminiError('RATE_LIMITED');
      throw new GeminiError('UNAVAILABLE');
    }

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new GeminiError('INVALID_RESPONSE');
    }

    return body;
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
