import { BadRequestException } from '@nestjs/common';
import { BannedKeywordCategory } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ContentFilterService } from './content-filter.service';

function harness(
  keywords = [
    { id: 'k-1', keyword: 'cá độ', category: BannedKeywordCategory.GAMBLING },
  ],
) {
  const findMany = jest.fn().mockResolvedValue(keywords);
  const prisma = { bannedKeyword: { findMany } } as unknown as PrismaService;
  return { service: new ContentFilterService(prisma), findMany };
}

describe('ContentFilterService', () => {
  it.each([
    'Nội dung cá độ bị cấm',
    'Nội dung CÁ ĐỘ bị cấm',
    'Noi dung ca do bi cam',
    'Nội dung c.á đ.ộ bị cấm',
  ])('rejects normalized keyword match: %s', async (text) => {
    const { service } = harness();
    await service.refresh();
    try {
      service.filter(text, 'reject');
      throw new Error('Expected filter to reject');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toEqual({
        code: 'BANNED_CONTENT',
        message: 'Content contains prohibited keywords',
        matches: [
          { keyword: 'cá độ', category: BannedKeywordCategory.GAMBLING },
        ],
      });
    }
  });

  it('returns a structured reject-mode validation error', async () => {
    const { service } = harness();
    await service.refresh();
    expect(() => service.validate('cá độ')).toThrow(BadRequestException);
  });

  it('masks the original matched range', async () => {
    const { service } = harness();
    await service.refresh();
    expect(service.filter('Tránh c.á đ.ộ nhé', 'mask')).toEqual({
      value: 'Tránh *** nhé',
      matches: [{ keyword: 'cá độ', category: BannedKeywordCategory.GAMBLING }],
    });
  });

  it('refreshes the in-memory cache deterministically', async () => {
    const { service, findMany } = harness();
    await service.refresh();
    findMany.mockResolvedValue([
      {
        id: 'k-2',
        keyword: 'phishing',
        category: BannedKeywordCategory.MALICIOUS_LINK,
      },
    ]);
    await service.refresh();

    expect(service.filter('cá độ', 'reject')).toEqual({
      value: 'cá độ',
      matches: [],
    });
    expect(() => service.filter('PHISHING', 'reject')).toThrow(
      BadRequestException,
    );
  });

  it('does not match a keyword inside a normal longer word', async () => {
    const { service } = harness([
      { id: 'k-1', keyword: 'bet', category: BannedKeywordCategory.GAMBLING },
    ]);
    await service.refresh();
    expect(service.filter('A better tournament', 'reject')).toEqual({
      value: 'A better tournament',
      matches: [],
    });
  });
});
