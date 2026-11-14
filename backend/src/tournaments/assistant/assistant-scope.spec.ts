import { GeminiService } from '../../ai/gemini.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TournamentQueryService } from '../tournament-query.service';
import { AssistantContextService } from './assistant-context.service';
import { AssistantProposalService } from './assistant-proposal.service';
import { AssistantService } from './assistant.service';
import { scopeRefusal, researchUnavailable } from './assistant-scope';

function setup(plan: Record<string, unknown>) {
  const generateText = jest.fn().mockResolvedValue(
    JSON.stringify({
      action: 'answer',
      message: 'Generated answer',
      ...plan,
    }),
  );
  const researchEsports = jest.fn().mockResolvedValue(null);
  const findAllPublic = jest.fn();
  const prepare = jest.fn();
  const service = new AssistantService(
    { generateText, researchEsports } as unknown as GeminiService,
    {
      game: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'valorant', name: 'Valorant' }]),
      },
    } as unknown as PrismaService,
    { findAllPublic } as unknown as TournamentQueryService,
    {
      forTournament: jest.fn().mockResolvedValue({
        canManage: false,
        tournament: { name: 'Private Cup', slug: 'private-cup' },
        data: {
          canManage: false,
          canReview: false,
          privateFact: 'DO_NOT_SEND_TO_SEARCH',
        },
      }),
    } as unknown as AssistantContextService,
    { prepare } as unknown as AssistantProposalService,
  );
  return { service, generateText, researchEsports, findAllPublic, prepare };
}
const dto = {
  message: 'trái đất tự quay do nguyên lý nào',
  page: 'tournament' as const,
  slug: 'private-cup',
  locale: 'vi' as const,
  history: [],
};

describe('Arena topic and source boundary', () => {
  it('discards off-topic model text and does not invent a tournament source', async () => {
    const { service, researchEsports, findAllPublic, prepare } = setup({
      topic: 'off_topic',
      message: 'Trái đất quay do bảo toàn mô men động lượng.',
    });
    expect(await service.chat(dto)).toEqual({
      message: scopeRefusal('vi'),
      sources: [],
    });
    expect(researchEsports).not.toHaveBeenCalled();
    expect(findAllPublic).not.toHaveBeenCalled();
    expect(prepare).not.toHaveBeenCalled();
  });
  it.each(['esports', 'platform', 'catalog_game'])(
    'never attaches tournament sources to %s knowledge',
    async (topic) => {
      const { service } = setup({ topic, catalogGameId: 'valorant' });
      expect(
        await service.chat({ ...dto, message: 'Giải thích BO3' }),
      ).toMatchObject({ sources: [] });
    },
  );
  it('keeps the source for actual current-tournament facts', async () => {
    const { service } = setup({ topic: 'tournament' });
    expect(
      await service.chat({ ...dto, message: 'Hạn đăng ký?' }),
    ).toMatchObject({
      sources: [{ label: 'Private Cup', href: '/tournaments/private-cup' }],
    });
  });
  it('rejects gameplay questions about a game outside the catalog', async () => {
    const { service } = setup({
      topic: 'catalog_game',
      catalogGameId: 'unknown',
    });
    expect(await service.chat(dto)).toEqual({
      message: scopeRefusal('vi'),
      sources: [],
    });
  });
  it('fails closed when the model omits classification', async () => {
    const { service } = setup({});
    await expect(service.chat(dto)).rejects.toMatchObject({ status: 503 });
  });
  it('uses only grounded web output for current news and excludes private context from research', async () => {
    const { service, researchEsports } = setup({
      topic: 'current_esports',
      researchQuery: 'Faker current team',
      message: 'Unverified stale roster',
    });
    const grounded = {
      message: 'Verified news',
      sources: [{ label: 'Official team', href: 'https://example.com/roster' }],
      checkedAt: '2026-11-13T12:00:00Z',
    };
    researchEsports.mockResolvedValueOnce(grounded);
    expect(
      await service.chat({ ...dto, message: 'Faker đang ở đội nào?' }),
    ).toEqual(grounded);
    const prompt = (researchEsports.mock.calls as unknown[][])[0][0];
    expect(prompt).toContain('Faker current team');
    expect(prompt).not.toContain('DO_NOT_SEND_TO_SEARCH');
    expect(prompt).not.toContain('Private Cup');
  });
  it('does not substitute model memory when web evidence is missing', async () => {
    const { service } = setup({
      topic: 'current_esports',
      researchQuery: 'Latest esports news',
      message: 'Made up news',
    });
    expect(await service.chat(dto)).toEqual({
      message: researchUnavailable('vi'),
      sources: [],
    });
  });
});
