import {
  parseSearchIntent,
  TournamentAiSearchService,
} from './tournament-ai-search.service';
import { GeminiError, GeminiService } from '../ai/gemini.service';
import { PrismaService } from '../prisma/prisma.service';
import { TournamentQueryService } from './tournament-query.service';
import { RoundSettingsService } from '../brackets/round-settings.service';
import { StandingsService } from '../brackets/standings.service';

describe('AI tournament search', () => {
  it.each([
    '{"visibility":"PRIVATE"}',
    '{"gameId":"unknown"}',
    '{"status":"DRAFT"}',
    '{"registrationOnly":"true"}',
    '{"startFrom":"tomorrow"}',
    '{"startFrom":"2026-12-02T00:00:00Z","startBefore":"2026-12-01T00:00:00Z"}',
    '{"__proto__":"bad"}',
    '{"gameId":""}',
    '[]',
  ])('rejects untrusted filters: %s', (text) => {
    expect(() => parseSearchIntent(text, ['valorant'])).toThrow();
  });

  it('uses only validated filters and never sends tournament records to Gemini', async () => {
    const generateText = jest
      .fn()
      .mockResolvedValue('{"gameId":"valorant","mode":"ONLINE"}');
    const findAllPublic = jest
      .fn()
      .mockResolvedValue({ data: [], pagination: { total: 0 } });
    const service = new TournamentAiSearchService(
      { generateText } as unknown as GeminiService,
      {
        game: {
          findMany: jest
            .fn()
            .mockResolvedValue([
              { id: 'valorant', name: 'Valorant', code: 'VALORANT' },
            ]),
        },
      } as unknown as PrismaService,
      { findAllPublic } as unknown as TournamentQueryService,
    );
    await service.search({ query: 'Valorant online', locale: 'vi' }, 'viewer');
    expect(findAllPublic).toHaveBeenCalledWith(
      { gameId: 'valorant', mode: 'ONLINE', limit: 6 },
      'viewer',
    );
    generateText.mockRejectedValueOnce(new GeminiError('RATE_LIMITED'));
    await expect(
      service.search({ query: 'Valorant', locale: 'vi' }),
    ).rejects.toMatchObject({ status: 429 });
  });

  it('keeps visibility restrictions and excludes full, closed or bracket-locked registrations before pagination', async () => {
    const base = {
      id: 'open',
      status: 'REGISTRATION',
      registrationOpen: true,
      registrationStartDate: null,
      registrationDeadline: null,
      startDate: null,
      maxTeams: 4,
      _count: { teams: 2 },
      rounds: [],
    };
    const findMany = jest
      .fn()
      .mockResolvedValueOnce([
        base,
        { ...base, id: 'full', _count: { teams: 4 } },
        { ...base, id: 'closed', registrationOpen: false },
        {
          ...base,
          id: 'locked',
          rounds: [{ _count: { matches: 1, groups: 0 } }],
        },
      ])
      .mockResolvedValueOnce([]);
    const count = jest.fn().mockResolvedValue(0);
    const service = new TournamentQueryService(
      { tournament: { findMany, count } } as unknown as PrismaService,
      {} as RoundSettingsService,
      {} as StandingsService,
    );
    await service.findAllPublic({
      registrationOnly: true,
      format: 'SWISS',
      formats: ['SWISS', 'PLAYOFF'],
      startFrom: '2026-12-01T00:00:00+07:00',
      limit: 6,
    });
    const args = (findMany.mock.calls as unknown[][])[1][0] as {
      where: Record<string, unknown>;
      take: number;
    };
    expect(args.where.visibility).toBe('PUBLIC');
    expect(args.where.moderationStatus).toBe('ACTIVE');
    expect(args.where.status).toEqual({ not: 'DRAFT' });
    expect(args.where.id).toEqual({ in: ['open'] });
    expect(args.where.rounds).toEqual({ some: { format: 'SWISS' } });
    expect(args.where.AND).toEqual([
      { rounds: { some: { format: 'SWISS' } } },
      { rounds: { some: { format: 'PLAYOFF' } } },
    ]);
    expect(args.take).toBe(6);
  });
});
