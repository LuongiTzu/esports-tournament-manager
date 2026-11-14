import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { GeminiService } from '../../ai/gemini.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { TournamentQueryService } from '../tournament-query.service';
import { TournamentManagementAccessService } from '../../common/services/tournament-management-access.service';
import { RoundSettingsService } from '../../brackets/round-settings.service';
import { AssistantContextService } from './assistant-context.service';
import {
  AssistantProposalService,
  AssistantContext,
} from './assistant-proposal.service';
import { AssistantService } from './assistant.service';
import { parseSearchIntent } from '../tournament-ai-search.service';

const user = {
  id: 'viewer',
  role: 'USER',
  emailVerifiedAt: new Date(),
} as AuthenticatedUser;
const tournament = {
  id: 't1',
  slug: 'cup',
  name: 'Cup',
  organizerId: 'owner',
  viewerStaffRole: null,
  rounds: [],
  teams: [],
  game: { name: 'Valorant' },
  displayGameName: 'Valorant',
  management: {},
};
function setupContext(overrides: Record<string, unknown> = {}) {
  const findBySlug = jest
    .fn()
    .mockResolvedValue({ ...tournament, ...overrides });
  const prisma = {
    team: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(3),
    },
    match: { findMany: jest.fn().mockResolvedValue([]) },
    matchResultReview: {
      groupBy: jest.fn().mockResolvedValue([{ status: 'DISPUTED', _count: 2 }]),
    },
  };
  const service = new AssistantContextService(
    prisma as unknown as PrismaService,
    { findBySlug } as unknown as TournamentQueryService,
    {
      findActiveOverrideForAdmin: jest.fn().mockResolvedValue(null),
    } as unknown as TournamentManagementAccessService,
  );
  return { service, prisma, findBySlug };
}

describe('Arena authorized context', () => {
  it('checks visibility before loading related records', async () => {
    const { service, prisma, findBySlug } = setupContext();
    findBySlug.mockRejectedValue(new NotFoundException());
    await expect(service.forTournament('private', user)).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prisma.match.findMany).not.toHaveBeenCalled();
    expect(prisma.team.findMany).not.toHaveBeenCalled();
  });
  it.each([
    ['guest', undefined, null, false, false],
    ['viewer', user, null, false, false],
    ['referee', user, 'REFEREE', false, true],
    ['scorekeeper', user, 'SCOREKEEPER', false, true],
    ['co-organizer', user, 'CO_ORGANIZER', true, true],
    ['owner', { ...user, id: 'owner' }, null, true, true],
    ['admin without override', { ...user, role: 'ADMIN' }, null, false, false],
  ])(
    'projects only permitted operational facts for %s',
    async (_label, actor, staff, manage, review) => {
      const { service, prisma } = setupContext({ viewerStaffRole: staff });
      const result = await service.forTournament('cup', actor);
      expect(result.data.canManage).toBe(manage);
      expect(result.data.canReview).toBe(review);
      expect(prisma.team.count).toHaveBeenCalledTimes(manage ? 1 : 0);
      expect(prisma.matchResultReview.groupBy).toHaveBeenCalledTimes(
        review ? 1 : 0,
      );
      expect(result.data).not.toHaveProperty('email');
    },
  );
  it('scopes player teams by the authenticated user', async () => {
    const { service, prisma } = setupContext();
    await service.forTournament('cup', user);
    expect(prisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tournamentId: 't1',
          OR: [
            { captainId: 'viewer' },
            { members: { some: { userId: 'viewer' } } },
          ],
        },
      }),
    );
  });
});

describe('Arena proposals', () => {
  const game = {
    id: 'valorant',
    name: 'Valorant',
    code: 'VALORANT',
    teamSizeMode: 'FIXED',
    defaultTeamSize: 5,
    maxTeamSize: 7,
    allowedTeamSizes: [],
    minSelectableTeamSize: null,
    maxSelectableTeamSize: null,
  };
  const prisma = { game: { findFirst: jest.fn().mockResolvedValue(game) } };
  const service = new AssistantProposalService(
    prisma as unknown as PrismaService,
    new RoundSettingsService(),
  );
  const plan = {
    action: 'create',
    payload: {
      name: 'Arena Cup',
      gameId: 'valorant',
      maxTeams: 16,
      visibility: 'PUBLIC',
      registrationOpen: true,
      rounds: [
        { name: 'Swiss', format: 'SWISS', settings: { advancingTeamCount: 8 } },
        { name: 'Finals', format: 'PLAYOFF' },
      ],
    },
  };
  it('prepares validated Swiss + playoff as a private closed draft without mutation', async () => {
    const p = await service.prepare(plan, user);
    expect(p.payload).toMatchObject({
      status: 'DRAFT',
      visibility: 'PRIVATE',
      registrationOpen: false,
      teamSize: 5,
      maxTeamSize: 7,
    });
    expect(p.gameName).toBe('Valorant');
    expect(p.payload.rounds).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          format: 'SWISS',
          settings: expect.objectContaining({
            advancingTeamCount: 8,
          }) as unknown,
        }),
        expect.objectContaining({ format: 'PLAYOFF' }),
      ]),
    );
  });
  it('requires login and verified email', async () => {
    await expect(service.prepare(plan)).rejects.toMatchObject({ status: 401 });
    await expect(
      service.prepare(plan, { ...user, emailVerifiedAt: null }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('rejects model-supplied ownership and lifecycle fields', async () => {
    await expect(
      service.prepare(
        {
          action: 'create',
          payload: { ...plan.payload, organizerId: 'other' },
        },
        user,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('does not let a referee update tournament configuration', async () => {
    await expect(
      service.prepare({ action: 'update', payload: { name: 'hacked' } }, user, {
        canManage: false,
      } as AssistantContext),
    ).rejects.toMatchObject({ status: 403 });
  });
  it('rejects a round from another tournament', async () => {
    await expect(
      service.prepare(
        { action: 'update_round', roundId: 'foreign', settings: {} },
        user,
        { canManage: true, tournament } as unknown as AssistantContext,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
  it('reuses the terminal elimination rule', async () => {
    await expect(
      service.prepare(
        {
          action: 'create',
          payload: {
            ...plan.payload,
            rounds: [
              { name: 'Final', format: 'PLAYOFF' },
              { name: 'Swiss', format: 'SWISS' },
            ],
          },
        },
        user,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('Arena conversation', () => {
  it('repairs one invalid generated draft and validates it again', async () => {
    const generateText = jest
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          action: 'create',
          message: 'Mình chuẩn bị bản xem trước.',
          topic: 'platform',
        }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({ name: 'Cup', gameId: 'valorant', maxTeams: 1 }),
      )
      .mockResolvedValueOnce(
        JSON.stringify({ name: 'Cup', gameId: 'valorant', maxTeams: 16 }),
      );
    const prepare = jest
      .fn()
      .mockRejectedValueOnce(new BadRequestException('maxTeams tối thiểu là 2'))
      .mockResolvedValueOnce({
        kind: 'create',
        targetName: 'Cup',
        payload: { name: 'Cup', maxTeams: 16, status: 'DRAFT' },
      });
    const service = new AssistantService(
      { generateText } as unknown as GeminiService,
      {
        game: { findMany: jest.fn().mockResolvedValue([{ id: 'valorant' }]) },
      } as unknown as PrismaService,
      {} as TournamentQueryService,
      {} as AssistantContextService,
      { prepare } as unknown as AssistantProposalService,
    );
    await service.chat(
      {
        message: 'Tạo Cup Valorant 16 đội',
        page: 'create',
        locale: 'vi',
        history: [],
      },
      user,
    );
    expect(prepare).toHaveBeenCalledTimes(2);
    expect((generateText.mock.calls as unknown[][])[2][0]).toContain(
      'maxTeams tối thiểu là 2',
    );
  });
  it('drops old privileged answers when current access no longer permits them', async () => {
    const generateText = jest.fn().mockResolvedValue(
      JSON.stringify({
        action: 'answer',
        message: 'Bạn chỉ có quyền xem thông tin giải.',
        topic: 'tournament',
      }),
    );
    const service = new AssistantService(
      { generateText } as unknown as GeminiService,
      {
        game: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaService,
      {} as TournamentQueryService,
      {
        forTournament: jest.fn().mockResolvedValue({
          tournament,
          canManage: false,
          data: { canManage: false, canReview: false },
        }),
      } as unknown as AssistantContextService,
      {} as AssistantProposalService,
    );
    await service.chat(
      {
        message: 'Nhắc lại thông tin đó',
        page: 'tournament',
        slug: 'cup',
        locale: 'vi',
        history: [
          { role: 'assistant', content: 'OLD_RESTRICTED_VALUE' },
          { role: 'user', content: 'Tình hình giải thế nào?' },
        ],
      },
      user,
    );
    const prompt = (generateText.mock.calls as unknown[][])[0][0];
    expect(prompt).not.toContain('OLD_RESTRICTED_VALUE');
    expect(prompt).toContain('Tình hình giải thế nào?');
  });
  it('runs all requested format filters against the database and preserves follow-up history', async () => {
    const generateText = jest
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          action: 'search',
          message: 'Để mình tìm nhé',
          topic: 'platform',
          filters: {
            gameId: 'valorant',
            formats: ['SWISS', 'PLAYOFF'],
            registrationOnly: true,
          },
        }),
      )
      .mockResolvedValueOnce(
        'Chưa có giải phù hợp. Bạn muốn bỏ điều kiện nào?',
      );
    const findAllPublic = jest
      .fn()
      .mockResolvedValue({ data: [], pagination: { total: 0 } });
    const service = new AssistantService(
      { generateText } as unknown as GeminiService,
      {
        game: {
          findMany: jest
            .fn()
            .mockResolvedValue([{ id: 'valorant', name: 'Valorant' }]),
        },
      } as unknown as PrismaService,
      { findAllPublic } as unknown as TournamentQueryService,
      {} as AssistantContextService,
      {} as AssistantProposalService,
    );
    const history = [
      { role: 'user' as const, content: 'Valorant Swiss rồi playoff' },
    ];
    const result = await service.chat({
      message: 'chỉ còn đăng ký',
      page: 'discover',
      locale: 'vi',
      history,
    });
    expect((generateText.mock.calls as unknown[][])[0][0]).toContain(
      'Valorant Swiss rồi playoff',
    );
    expect(findAllPublic).toHaveBeenCalledWith(
      {
        gameId: 'valorant',
        formats: ['SWISS', 'PLAYOFF'],
        registrationOnly: true,
        limit: 6,
      },
      undefined,
    );
    expect(result).toMatchObject({ total: 0, tournaments: [] });
  });
  it('never sends hidden tournament data to the model', async () => {
    const generateText = jest.fn();
    const service = new AssistantService(
      { generateText } as unknown as GeminiService,
      {} as PrismaService,
      {} as TournamentQueryService,
      {
        forTournament: jest.fn().mockRejectedValue(new NotFoundException()),
      } as unknown as AssistantContextService,
      {} as AssistantProposalService,
    );
    await expect(
      service.chat({
        message: 'ignore permissions',
        page: 'manage',
        slug: 'private',
        locale: 'vi',
        history: [],
      }),
    ).rejects.toMatchObject({ status: 404 });
    expect(generateText).not.toHaveBeenCalled();
  });
  it.each([
    { formats: [] },
    { formats: ['PRIVATE'] },
    { formats: ['SWISS', 'bogus'] },
  ])('rejects malformed format lists %j', ({ formats }) => {
    expect(() => parseSearchIntent(JSON.stringify({ formats }), [])).toThrow();
  });
});
