import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../../auth/strategies/jwt.strategy';
import { PrismaService } from '../../prisma/prisma.service';
import { TournamentQueryService } from '../tournament-query.service';

export const recordReports = [
  'my_history',
  'my_teammates',
  'my_results',
  'my_wins',
  'tournament_results',
  'tournament_wins',
] as const;
type RecordReport = (typeof recordReports)[number];
type Source = { label: string; href: string };
const DISPLAY_LIMIT = 20;
const matchSelect = {
  id: true,
  matchNumber: true,
  status: true,
  scoreA: true,
  scoreB: true,
  isBye: true,
  bestOf: true,
  outcome: true,
  winnerTeamId: true,
  teamA: { select: { id: true, name: true } },
  teamB: { select: { id: true, name: true } },
  round: {
    select: {
      name: true,
      settings: true,
      tournament: { select: { name: true, slug: true } },
    },
  },
} satisfies Prisma.MatchSelect;
type ReportMatch = Prisma.MatchGetPayload<{ select: typeof matchSelect }>;

@Injectable()
export class AssistantRecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tournaments: TournamentQueryService,
  ) {}

  async answer(
    report: unknown,
    locale: 'vi' | 'en',
    slug?: string,
    user?: AuthenticatedUser,
    teamName?: unknown,
  ) {
    if (!recordReports.some((value) => value === report))
      throw new BadRequestException('Báo cáo không hợp lệ.');
    const kind = report as RecordReport;
    const vi = locale === 'vi';
    const personal = kind.startsWith('my_');
    if (personal && !user)
      return {
        message: vi
          ? 'Bạn đăng nhập để mình tra đội, đồng đội và lịch sử thi đấu của đúng tài khoản nhé.'
          : 'Please sign in so I can look up your teams, teammates and match history.',
        sources: [],
      };
    if (!personal && !slug)
      return {
        message: vi
          ? 'Bạn mở giải muốn xem rồi hỏi lại nhé. Mình cần xác định giải trước khi thống kê số trận thắng hoặc tỉ số.'
          : 'Open the tournament first so I can look up its wins or results.',
        sources: [],
      };
    if (
      teamName !== undefined &&
      (typeof teamName !== 'string' ||
        !teamName.trim() ||
        teamName.length > 100)
    )
      throw new BadRequestException('Tên đội không hợp lệ.');
    const nameFilter =
      typeof teamName === 'string'
        ? { name: { contains: teamName.trim(), mode: 'insensitive' as const } }
        : {};
    // Reuse the existing joined-list contract, then recheck visibility before any match/roster read.
    const candidates = slug
      ? [await this.tournaments.findBySlug(slug, user?.id, user?.role)]
      : await this.tournaments.findMyTournaments(
          user!.id,
          'joined',
          user!.role,
        );
    const visible = [] as { id: string; name: string; slug: string }[];
    for (const item of candidates) {
      if (slug) {
        visible.push(item);
        continue;
      }
      try {
        const tournament = await this.tournaments.findBySlug(
          item.slug,
          user?.id,
          user?.role,
        );
        visible.push(tournament);
      } catch (error) {
        // Inaccessible/deleted records must not leak through personal history.
        if (error instanceof NotFoundException) continue;
        throw error;
      }
    }
    const tournamentIds = visible.map((t) => t.id);
    const teamWhere: Prisma.TeamWhereInput = {
      tournamentId: { in: tournamentIds },
      ...nameFilter,
      ...(personal
        ? {
            OR: [
              { captainId: user!.id },
              { members: { some: { userId: user!.id } } },
            ],
          }
        : { status: 'APPROVED' }),
    };
    const sources: Source[] = [];
    const source = (name: string, tournamentSlug: string) => {
      const href = `/tournaments/${encodeURIComponent(tournamentSlug)}`;
      if (!sources.some((s) => s.href === href))
        sources.push({ label: name, href });
    };
    if (kind === 'my_history' || kind === 'my_teammates') {
      const [total, teams] = await Promise.all([
        this.prisma.team.count({ where: teamWhere }),
        this.prisma.team.findMany({
          where: teamWhere,
          take: DISPLAY_LIMIT,
          orderBy: [{ registeredAt: 'desc' }, { id: 'asc' }],
          select: {
            id: true,
            name: true,
            status: true,
            tournament: { select: { name: true, slug: true } },
            members: {
              orderBy: { orderIndex: 'asc' },
              where: { OR: [{ userId: null }, { userId: { not: user!.id } }] },
              select: { ign: true, position: true, memberRole: true },
            },
          },
        }),
      ]);
      const statuses = {
        PENDING: vi ? 'chờ duyệt' : 'pending',
        APPROVED: vi ? 'đã duyệt' : 'approved',
        REJECTED: vi ? 'bị từ chối' : 'rejected',
      };
      const rows = teams.map((t) => {
        source(t.tournament.name, t.tournament.slug);
        const roster = t.members
          .map((m) => `${m.ign}${m.position ? ` (${m.position})` : ''}`)
          .join(', ');
        return `• ${t.tournament.name} — ${t.name} (${statuses[t.status]}).${kind === 'my_teammates' ? ` ${vi ? 'Đồng đội trong danh sách hiện lưu' : 'Other recorded members'}: ${roster || (vi ? 'chưa có' : 'none')}.` : ''}`;
      });
      return {
        message: [
          vi
            ? `Mình tìm thấy ${total} hồ sơ đội gắn với tài khoản của bạn${slug ? ' trong giải này' : ' ở các giải bạn còn quyền xem'}. Hiển thị ${teams.length} hồ sơ mới nhất.`
            : `Found ${total} team registrations linked to your account. Showing the latest ${teams.length}.`,
          ...rows,
          vi
            ? 'Hồ sơ đăng ký không đồng nghĩa đã thi đấu. Danh sách thành viên là dữ liệu hiện lưu; hệ thống chưa lưu lịch sử thay đổi đội hình hoặc xác nhận ai thực sự ra sân. Tên nhập tay chưa liên kết tài khoản không dùng để nhận diện bạn.'
            : 'Registration does not prove participation. Rosters reflect current records, not historical lineups or actual appearances. Unlinked names do not identify your account.',
        ].join('\n\n'),
        sources,
      };
    }
    const teams = await this.prisma.team.findMany({
      where: teamWhere,
      select: {
        id: true,
        name: true,
        tournament: { select: { name: true, slug: true } },
      },
    });
    const ids = teams.map((t) => t.id);
    const where: Prisma.MatchWhereInput = {
      round: { tournamentId: { in: tournamentIds } },
      isActive: true,
      status: 'COMPLETED',
      isBye: false,
      ...(personal || teamName !== undefined
        ? { OR: [{ teamAId: { in: ids } }, { teamBId: { in: ids } }] }
        : {}),
    };
    if (kind === 'tournament_wins' || kind === 'my_wins') {
      const wins = await this.prisma.match.groupBy({
        by: ['winnerTeamId'],
        where: { ...where, winnerTeamId: { in: ids } },
        _count: { _all: true },
      });
      const byId = new Map(teams.map((t) => [t.id, t]));
      const sorted = wins
        .map((w) => ({ ...byId.get(w.winnerTeamId!)!, wins: w._count._all }))
        .sort((a, b) => b.wins - a.wins || a.name.localeCompare(b.name));
      for (const t of sorted.slice(0, DISPLAY_LIMIT))
        source(t.tournament.name, t.tournament.slug);
      const scopeName = personal
        ? vi
          ? 'các đội gắn với tài khoản của bạn'
          : 'your linked teams'
        : visible[0].name;
      return {
        message: [
          vi
            ? `Số trận thắng của ${scopeName}${typeof teamName === 'string' ? `, lọc tên đội chứa “${teamName}”` : ''} (toàn bộ trận đã hoàn tất, đang có hiệu lực; không tính lượt miễn đấu):`
            : `Match wins for ${scopeName} (all active completed matches, excluding byes):`,
          ...sorted
            .slice(0, DISPLAY_LIMIT)
            .map(
              (t) =>
                `• ${t.name}${personal ? ` / ${t.tournament.name}` : ''}: ${t.wins} ${vi ? 'trận thắng' : 'wins'}.`,
            ),
          sorted.length
            ? vi
              ? 'Đội cùng số trận thắng được xem là đồng hạng theo tiêu chí này. Đây không phải bảng xếp hạng chính thức, không phải số ván thắng hay tỉ số trận.'
              : 'Equal win counts are tied on this metric. This is not the official standings, game wins or a match score.'
            : vi
              ? 'Chưa có trận thắng được ghi nhận cho phạm vi này.'
              : 'No recorded wins in this scope.',
          sorted.length > DISPLAY_LIMIT
            ? vi
              ? `Hiển thị ${DISPLAY_LIMIT}/${sorted.length} đội có trận thắng.`
              : `Showing ${DISPLAY_LIMIT}/${sorted.length} teams with wins.`
            : '',
        ]
          .filter(Boolean)
          .join('\n\n'),
        sources,
      };
    }
    const [total, matches] = await Promise.all([
      this.prisma.match.count({ where }),
      this.prisma.match.findMany({
        where,
        take: DISPLAY_LIMIT,
        orderBy: [
          { playedAt: { sort: 'desc', nulls: 'last' } },
          { updatedAt: 'desc' },
          { id: 'asc' },
        ],
        select: matchSelect,
      }),
    ]);
    for (const m of matches)
      source(m.round.tournament.name, m.round.tournament.slug);
    return {
      message: [
        vi
          ? `Có ${total} trận đã hoàn tất trong phạm vi ${personal ? 'các đội gắn với tài khoản của bạn' : visible[0].name}${teamName ? `, đội ${String(teamName)}` : ''}. Hiển thị ${matches.length} trận gần nhất, không tính lượt miễn đấu.`
          : `${total} completed matches in this scope. Showing the latest ${matches.length}, excluding byes.`,
        ...matches.map((m) => formatMatch(m, vi)),
        vi
          ? 'Các tỉ số trên là giá trị đang lưu cho từng trận, không phải số trận thắng–thua. Trận chưa kết thúc không được coi là kết quả cuối cùng.'
          : 'These are stored match scores, not a win–loss record. Unfinished matches are not final results.',
      ].join('\n\n'),
      sources,
    };
  }
}

function formatMatch(m: ReportMatch, vi: boolean) {
  const settings = m.round.settings;
  const pointScore =
    settings !== null &&
    typeof settings === 'object' &&
    !Array.isArray(settings) &&
    settings.scoringMode === 'POINT_SCORE';
  const unit = pointScore ? (vi ? 'điểm' : 'points') : vi ? 'ván' : 'games';
  const winner =
    m.winnerTeamId === m.teamA?.id
      ? m.teamA?.name
      : m.winnerTeamId === m.teamB?.id
        ? m.teamB?.name
        : null;
  const outcome =
    m.outcome === 'DRAW'
      ? vi
        ? 'hòa'
        : 'draw'
      : winner
        ? `${vi ? 'đội thắng' : 'winner'}: ${winner}`
        : vi
          ? 'chưa có đội thắng được ghi nhận'
          : 'no recorded winner';
  return `• ${m.round.tournament.name} / ${m.round.name}${m.matchNumber !== null ? ` #${m.matchNumber}` : ''}: ${m.teamA?.name ?? '?'} ${m.scoreA}–${m.scoreB} ${m.teamB?.name ?? '?'} (${unit}, BO${m.bestOf}; ${outcome}).`;
}
