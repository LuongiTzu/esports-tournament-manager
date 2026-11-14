import { NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { TournamentQueryService } from '../tournament-query.service';
import { AssistantRecordsService } from './assistant-records.service';
import { AssistantService } from './assistant.service';
import { AssistantContextService } from './assistant-context.service';
import { AssistantProposalService } from './assistant-proposal.service';
import { GeminiService } from '../../ai/gemini.service';

const viewer = { id: 'viewer', role: 'USER' } as AuthenticatedUser;
const cup = { id: 'cup-id', slug: 'cup', name: 'Cup' };
function setup() {
  const prisma = {
    team: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    match: {
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
      groupBy: jest.fn().mockResolvedValue([]),
    },
  };
  const tournaments = {
    findBySlug: jest.fn().mockResolvedValue(cup),
    findMyTournaments: jest.fn().mockResolvedValue([cup]),
  };
  const service = new AssistantRecordsService(
    prisma as unknown as PrismaService,
    tournaments as unknown as TournamentQueryService,
  );
  return { prisma, tournaments, service };
}

describe('Arena database reports', () => {
  it.each(['my_history', 'my_teammates', 'my_results', 'my_wins'])(
    'requires a real account for %s without reading data',
    async (report) => {
      const { service, prisma, tournaments } = setup();
      const reply = await service.answer(report, 'vi');
      expect(reply.message).toContain('đăng nhập');
      expect(reply.sources).toEqual([]);
      expect(tournaments.findMyTournaments).not.toHaveBeenCalled();
      expect(prisma.team.findMany).not.toHaveBeenCalled();
    },
  );
  it('asks for a tournament rather than claiming a global ranking', async () => {
    const { service, prisma } = setup();
    expect((await service.answer('tournament_wins', 'vi')).message).toContain(
      'mở giải',
    );
    expect(prisma.match.groupBy).not.toHaveBeenCalled();
  });
  it('checks visibility before any scores, statistics or roster reads', async () => {
    const { service, prisma, tournaments } = setup();
    tournaments.findBySlug.mockRejectedValue(new NotFoundException());
    await expect(
      service.answer('tournament_wins', 'vi', 'hidden', viewer),
    ).rejects.toMatchObject({ status: 404 });
    expect(prisma.team.findMany).not.toHaveBeenCalled();
    expect(prisma.match.groupBy).not.toHaveBeenCalled();
  });
  it('omits revoked tournament access and only queries teams linked to the authenticated user', async () => {
    const { service, prisma, tournaments } = setup();
    tournaments.findMyTournaments.mockResolvedValue([
      cup,
      { id: 'hidden-id', slug: 'hidden', name: 'Secret' },
    ]);
    tournaments.findBySlug
      .mockResolvedValueOnce(cup)
      .mockRejectedValueOnce(new NotFoundException());
    prisma.team.count.mockResolvedValue(23);
    prisma.team.findMany.mockResolvedValue([
      {
        id: 'a',
        name: 'Alpha',
        status: 'PENDING',
        tournament: cup,
        members: [
          { ign: 'Player One', position: 'Support', memberRole: 'PLAYER' },
        ],
      },
    ]);
    const reply = await service.answer('my_teammates', 'vi', undefined, viewer);
    expect(prisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          tournamentId: { in: ['cup-id'] },
          OR: [
            { captainId: 'viewer' },
            { members: { some: { userId: 'viewer' } } },
          ],
        },
        take: 20,
        select: expect.objectContaining({
          members: expect.objectContaining({
            select: { ign: true, position: true, memberRole: true },
          }) as unknown,
        }) as unknown,
      }),
    );
    expect(reply.message).toContain('23 hồ sơ');
    expect(reply.message).toContain('Hiển thị 1');
    expect(reply.message).toContain('Player One (Support)');
    expect(reply.message).toContain('chờ duyệt');
    expect(reply.message).toContain('chưa lưu lịch sử thay đổi đội hình');
    expect(reply.message).not.toContain('Secret');
    expect(reply.sources).toEqual([{ label: 'Cup', href: '/tournaments/cup' }]);
  });
  it('aggregates all completed active wins, excludes byes and preserves ties', async () => {
    const { service, prisma } = setup();
    prisma.team.findMany.mockResolvedValue([
      { id: 'a', name: 'Alpha', tournament: cup },
      { id: 'b', name: 'Beta', tournament: cup },
    ]);
    prisma.match.groupBy.mockResolvedValue([
      { winnerTeamId: 'b', _count: { _all: 105 } },
      { winnerTeamId: 'a', _count: { _all: 105 } },
    ]);
    const reply = await service.answer('tournament_wins', 'vi', 'cup');
    expect(prisma.match.groupBy).toHaveBeenCalledWith({
      by: ['winnerTeamId'],
      where: {
        round: { tournamentId: { in: ['cup-id'] } },
        isActive: true,
        status: 'COMPLETED',
        isBye: false,
        winnerTeamId: { in: ['a', 'b'] },
      },
      _count: { _all: true },
    });
    expect(reply.message).toContain('Alpha: 105 trận thắng');
    expect(reply.message).toContain('Beta: 105 trận thắng');
    expect(reply.message).toContain('đồng hạng');
    expect(reply.message).toContain('không phải bảng xếp hạng chính thức');
    expect(prisma.match.findMany).not.toHaveBeenCalled();
  });
  it('copies exact match scores, distinguishes points, games and draws, and states the result limit', async () => {
    const { service, prisma } = setup();
    const match = {
      id: 'm1',
      matchNumber: 1,
      scoreA: 1,
      scoreB: 2,
      bestOf: 3,
      outcome: 'TEAM_B',
      winnerTeamId: 'b',
      teamA: { id: 'a', name: 'Alpha' },
      teamB: { id: 'b', name: 'Beta' },
      round: {
        name: 'Final',
        settings: { scoringMode: 'SERIES_SCORE' },
        tournament: cup,
      },
    };
    prisma.match.count.mockResolvedValue(130);
    prisma.match.findMany.mockResolvedValue([
      match,
      {
        ...match,
        id: 'm2',
        scoreA: 13,
        scoreB: 9,
        winnerTeamId: 'a',
        outcome: 'TEAM_A',
        round: { ...match.round, settings: { scoringMode: 'POINT_SCORE' } },
      },
      {
        ...match,
        id: 'm3',
        scoreA: 1,
        scoreB: 1,
        outcome: 'DRAW',
        winnerTeamId: null,
      },
    ]);
    const reply = await service.answer('tournament_results', 'vi', 'cup');
    expect(reply.message).toContain('130 trận');
    expect(reply.message).toContain('Hiển thị 3');
    expect(reply.message).toContain(
      'Alpha 1–2 Beta (ván, BO3; đội thắng: Beta)',
    );
    expect(reply.message).toContain(
      'Alpha 13–9 Beta (điểm, BO3; đội thắng: Alpha)',
    );
    expect(reply.message).toContain('Alpha 1–1 Beta (ván, BO3; hòa)');
    expect(reply.message).not.toContain('3–0');
    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: 'COMPLETED',
          isActive: true,
          isBye: false,
        }) as unknown,
        take: 20,
      }),
    );
  });
  it('scopes personal match results to account team IDs, even with a typed foreign team name', async () => {
    const { service, prisma } = setup();
    await service.answer('my_results', 'vi', 'cup', viewer, 'Foreign');
    expect(prisma.team.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { captainId: 'viewer' },
            { members: { some: { userId: 'viewer' } } },
          ],
          name: { contains: 'Foreign', mode: 'insensitive' },
        }) as unknown,
      }),
    );
    expect(prisma.match.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [{ teamAId: { in: [] } }, { teamBId: { in: [] } }],
        }) as unknown,
      }),
    );
  });
  it('rejects unsupported report names before reading any records', async () => {
    const { service, prisma } = setup();
    await expect(
      service.answer('private_contacts', 'vi', 'cup', viewer),
    ).rejects.toMatchObject({ status: 400 });
    expect(prisma.team.findMany).not.toHaveBeenCalled();
  });
  it('uses the report reply instead of model-invented scores and does not send it back to Gemini', async () => {
    const generateText = jest.fn().mockResolvedValue(
      JSON.stringify({
        topic: 'platform',
        action: 'records',
        report: 'my_results',
        message: 'You won every match 3–0',
      }),
    );
    const answer = jest
      .fn()
      .mockResolvedValue({ message: 'Alpha 1–2 Beta', sources: [] });
    const service = new AssistantService(
      { generateText } as unknown as GeminiService,
      {
        game: { findMany: jest.fn().mockResolvedValue([]) },
      } as unknown as PrismaService,
      {} as TournamentQueryService,
      {} as AssistantContextService,
      {} as AssistantProposalService,
      { answer } as unknown as AssistantRecordsService,
    );
    const reply = await service.chat(
      {
        message: 'Tỉ số trận của tôi?',
        locale: 'vi',
        page: 'general',
        history: [],
      },
      viewer,
    );
    expect(reply.message).toBe('Alpha 1–2 Beta');
    expect(answer).toHaveBeenCalledWith(
      'my_results',
      'vi',
      undefined,
      viewer,
      undefined,
    );
    expect(generateText).toHaveBeenCalledTimes(1);
  });
});
