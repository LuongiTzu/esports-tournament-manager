import { BadRequestException, Injectable, OnModuleInit } from '@nestjs/common';
import { BannedKeywordCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ApplicationErrorCode } from '../errors/application-error-code';

export type ContentFilterMode = 'reject' | 'mask';

interface CachedKeyword {
  id: string;
  keyword: string;
  category: BannedKeywordCategory;
  canonical: string;
}

interface Match {
  keyword: CachedKeyword;
  start: number;
  end: number;
}

@Injectable()
export class ContentFilterService implements OnModuleInit {
  private keywords: CachedKeyword[] = [];

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const rows = await this.prisma.bannedKeyword.findMany({
      orderBy: { keyword: 'asc' },
    });
    this.keywords = rows
      .map((row) => ({ ...row, canonical: canonicalize(row.keyword) }))
      .filter((row) => row.canonical.length > 0)
      .sort(
        (a, b) =>
          b.canonical.length - a.canonical.length ||
          a.keyword.localeCompare(b.keyword),
      );
  }

  filter(text: string, mode: ContentFilterMode = 'reject') {
    const matches = this.findMatches(text);
    if (!matches.length) return { value: text, matches: [] };
    const details = matches.map(({ keyword }) => ({
      keyword: keyword.keyword,
      category: keyword.category,
    }));
    if (mode === 'reject') {
      throw new BadRequestException({
        code: ApplicationErrorCode.BANNED_CONTENT,
        message: 'Content contains prohibited keywords',
        matches: details,
      });
    }
    return { value: maskRanges(text, matches), matches: details };
  }

  validate(text: string): string {
    const trimmed = text.trim();
    return this.filter(trimmed, 'reject').value;
  }

  private findMatches(text: string): Match[] {
    const indexed = indexedCanonical(text);
    const matches: Match[] = [];
    for (const keyword of this.keywords) {
      let from = 0;
      while (from <= indexed.value.length - keyword.canonical.length) {
        const at = indexed.value.indexOf(keyword.canonical, from);
        if (at < 0) break;
        const endAt = at + keyword.canonical.length - 1;
        const start = indexed.originalIndexes[at];
        const end = indexed.originalIndexes[endAt] + 1;
        if (hasWordBoundaries(text, start, end)) {
          matches.push({ keyword, start, end });
          break;
        }
        from = at + 1;
      }
    }
    return matches.sort((a, b) => a.start - b.start || b.end - a.end);
  }
}

export function normalizeModerationText(text: string): string {
  return text
    .toLowerCase()
    .replace(/đ/g, 'd')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function canonicalize(text: string): string {
  return normalizeModerationText(text).replace(/[^a-z0-9]/g, '');
}

function indexedCanonical(text: string) {
  let value = '';
  const originalIndexes: number[] = [];
  for (let index = 0; index < text.length; index++) {
    const normalized = normalizeModerationText(text[index]);
    for (const char of normalized) {
      if (/[a-z0-9]/.test(char)) {
        value += char;
        originalIndexes.push(index);
      }
    }
  }
  return { value, originalIndexes };
}

function hasWordBoundaries(text: string, start: number, end: number): boolean {
  const before = start > 0 ? normalizeModerationText(text[start - 1]) : '';
  const after = end < text.length ? normalizeModerationText(text[end]) : '';
  return !/[a-z0-9]/.test(before) && !/[a-z0-9]/.test(after);
}

function maskRanges(text: string, matches: Match[]): string {
  const ranges = matches
    .map(({ start, end }) => ({ start, end }))
    .filter(
      (range, index, all) =>
        !all.some(
          (other, otherIndex) =>
            otherIndex !== index &&
            other.start <= range.start &&
            other.end >= range.end,
        ),
    )
    .sort((a, b) => b.start - a.start);
  return ranges.reduce(
    (result, range) =>
      `${result.slice(0, range.start)}***${result.slice(range.end)}`,
    text,
  );
}
