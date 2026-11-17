import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { GeminiService } from '../../ai/gemini.service';
import { RoundSettingsService } from '../../brackets/round-settings.service';
import { TournamentQueryService } from '../tournament-query.service';
import { AssistantContextService } from './assistant-context.service';
import {
  AssistantProposalService,
  AssistantContext,
} from './assistant-proposal.service';
import { AssistantService } from './assistant.service';

const user = {
  id: 'owner',
  role: 'SIGNED_UP_USER',
  emailVerifiedAt: new Date(),
} as AuthenticatedUser;
const context = {
  canManage: true,
  tournament: {
    id: 'cup',
    slug: 'draft-cup',
    name: 'Draft Cup',
    status: 'DRAFT',
    visibility: 'PRIVATE',
    registrationOpen: false,
  },
  data: { canManage: true, canReview: true },
} as unknown as AssistantContext;
const proposals = new AssistantProposalService(
  {} as PrismaService,
  new RoundSettingsService(),
);
const payload = { visibility: 'PUBLIC', registrationOpen: true };

describe('Arena publication preview', () => {
  it.each([
    ['PUBLIC', true],
    ['PUBLIC', false],
    ['PRIVATE', true],
    ['PRIVATE', false],
  ])(
    'preserves explicit %s visibility and registration=%s without writing',
    async (visibility, registrationOpen) => {
      const reply = await proposals.prepare(
        { action: 'publish', payload: { visibility, registrationOpen } },
        user,
        context,
      );
      expect(reply).toEqual({
        kind: 'publish',
        targetId: 'cup',
        slug: 'draft-cup',
        targetName: 'Draft Cup',
        payload: { status: 'REGISTRATION', visibility, registrationOpen },
        before: {
          status: 'DRAFT',
          visibility: 'PRIVATE',
          registrationOpen: false,
        },
      });
      expect(context.tournament.status).toBe('DRAFT');
    },
  );
  it('requires authentication, verified email and current management permission', async () => {
    const plan = { action: 'publish', payload };
    await expect(proposals.prepare(plan)).rejects.toMatchObject({
      status: 401,
    });
    await expect(
      proposals.prepare(plan, { ...user, emailVerifiedAt: null }, context),
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      proposals.prepare(plan, user, { ...context, canManage: false }),
    ).rejects.toMatchObject({ status: 403 });
  });
  it.each(['REGISTRATION', 'ONGOING', 'COMPLETED', 'CANCELLED'] as const)(
    'rejects a stale publication request when status is %s',
    async (status) => {
      await expect(
        proposals.prepare({ action: 'publish', payload }, user, {
          ...context,
          tournament: { ...context.tournament, status },
        }),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
  it.each([
    { visibility: null, registrationOpen: true },
    { visibility: 'PUBLIC' },
    { visibility: 'PUBLIC', registrationOpen: 'true' },
    { ...payload, status: 'ONGOING' },
    { ...payload, organizerId: 'other' },
    { ...payload, name: 'Unexpected rename' },
  ])(
    'rejects missing choices or unrelated payload fields %j',
    async (invalid) => {
      await expect(
        proposals.prepare(
          { action: 'publish', payload: invalid },
          user,
          context,
        ),
      ).rejects.toMatchObject({ status: 400 });
    },
  );
  it('does not enable arbitrary lifecycle updates through the generic edit action', async () => {
    await expect(
      proposals.prepare(
        { action: 'update', payload: { status: 'ONGOING' } },
        user,
        context,
      ),
    ).rejects.toMatchObject({ status: 400 });
  });
});

describe('Arena publication conversation', () => {
  function setup(details: unknown) {
    const generateText = jest
      .fn()
      .mockResolvedValueOnce(
        JSON.stringify({
          topic: 'tournament',
          action: 'publish',
          report: null,
          message: 'Model must not claim publication already succeeded',
        }),
      )
      .mockResolvedValueOnce(JSON.stringify(details));
    const service = new AssistantService(
      { generateText } as unknown as GeminiService,
      {
        game: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaService,
      {} as TournamentQueryService,
      {
        forTournament: jest.fn().mockResolvedValue(context),
      } as unknown as AssistantContextService,
      proposals,
    );
    return { service, generateText };
  }
  const dto = {
    message: 'Xuất bản',
    page: 'tournament' as const,
    slug: 'draft-cup',
    locale: 'vi' as const,
    history: [],
  };
  it('asks for both choices instead of silently using private/closed draft defaults', async () => {
    const { service } = setup({ visibility: null, registrationOpen: null });
    const reply = await service.chat(dto, user);
    expect(reply.message).toContain('công khai hay riêng tư');
    expect(reply.message).toContain('Có bật mở đăng ký');
    expect(reply).not.toHaveProperty('proposal');
  });
  it('asks only the missing registration choice', async () => {
    const { service } = setup({ visibility: 'PUBLIC', registrationOpen: null });
    const reply = await service.chat(dto, user);
    expect(reply.message).not.toContain('công khai hay riêng tư');
    expect(reply.message).toContain('Có bật mở đăng ký');
    expect(reply).not.toHaveProperty('proposal');
  });
  it('returns a publish preview for a follow-up without claiming the tournament was published', async () => {
    const { service, generateText } = setup({
      visibility: 'PRIVATE',
      registrationOpen: false,
    });
    const reply = await service.chat(
      {
        ...dto,
        message: 'Riêng tư, chưa mở đăng ký',
        history: [
          { role: 'user', content: 'Xuất bản' },
          {
            role: 'assistant',
            content: 'Công khai hay riêng tư, có mở đăng ký không?',
          },
        ],
      },
      user,
    );
    expect(reply).toMatchObject({
      proposal: {
        kind: 'publish',
        payload: {
          status: 'REGISTRATION',
          visibility: 'PRIVATE',
          registrationOpen: false,
        },
      },
    });
    expect(reply.message).toContain('chưa được lưu');
    expect(reply.message).not.toContain('Model must not');
    expect(generateText).toHaveBeenCalledTimes(2);
  });
});
