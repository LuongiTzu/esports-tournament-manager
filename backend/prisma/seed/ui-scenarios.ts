import {
  Gender,
  MatchOutcome,
  MatchResultDecision,
  MatchResultReviewStatus,
  MatchStatus,
  MemberRole,
  ModerationStatus,
  RegistrationStatus,
  RoundFormat,
  RoundStatus,
  TournamentMode,
  TournamentStaffRole,
  TournamentStatus,
  Visibility,
} from '@prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { UI_SCENARIO_ACCOUNTS } from './data';

export const UI_SCENARIO_TOURNAMENT_ID = 'seed-tournament-ui-scenarios';
export const UI_SCENARIO_TOURNAMENT_SLUG = 'du-lieu-viet-ui-scenarios';

const ROUND_ID = 'seed-round-ui-scenarios';
const TEAM_A_ID = 'seed-team-ui-saigon-phoenix';
const TEAM_B_ID = 'seed-team-ui-hanoi-guardians';

const MATCH_IDS = {
  checkInOpen: 'seed-ui-match-check-in-open',
  checkInLater: 'seed-ui-match-check-in-later',
  unscheduled: 'seed-ui-match-unscheduled',
  ongoing: 'seed-ui-match-ongoing',
  pendingReview: 'seed-ui-match-review-pending',
  disputed: 'seed-ui-match-review-disputed',
  resolved: 'seed-ui-match-review-resolved',
  confirmed: 'seed-ui-match-review-confirmed',
} as const;

const HOUR = 60 * 60 * 1000;
const MINUTE = 60 * 1000;
const DAY = 24 * HOUR;

interface RosterMember {
  realName: string;
  ign: string;
  userId?: string;
}

const TEAM_A_ROSTER: RosterMember[] = [
  {
    realName: UI_SCENARIO_ACCOUNTS.captainA.displayName,
    ign: 'HuyNova',
    userId: UI_SCENARIO_ACCOUNTS.captainA.id,
  },
  {
    realName: UI_SCENARIO_ACCOUNTS.member.displayName,
    ign: 'LinhKite',
    userId: UI_SCENARIO_ACCOUNTS.member.id,
  },
  { realName: 'Nguyễn Nhật Minh', ign: 'MinhFrost' },
  { realName: 'Đỗ Thành Đạt', ign: 'DatBlaze' },
  { realName: 'Vũ Hải Anh', ign: 'HaiEcho' },
];

const TEAM_B_ROSTER: RosterMember[] = [
  {
    realName: UI_SCENARIO_ACCOUNTS.captainB.displayName,
    ign: 'PhucAres',
    userId: UI_SCENARIO_ACCOUNTS.captainB.id,
  },
  { realName: 'Trương Minh Khang', ign: 'KhangZero' },
  { realName: 'Hoàng Đức Anh', ign: 'DucStorm' },
  { realName: 'Phan Tuấn Kiệt', ign: 'KietRaven' },
  { realName: 'Bùi Quốc Khánh', ign: 'KhanhViper' },
];

export async function seedUiScenarios(prisma: PrismaService): Promise<void> {
  const game = await prisma.game.findUnique({
    where: { code: 'VALORANT' },
    select: { id: true, positions: true },
  });
  if (!game)
    throw new Error('VALORANT must exist before UI scenarios are seeded');

  const positions = Array.isArray(game.positions)
    ? game.positions.filter(
        (position): position is string => typeof position === 'string',
      )
    : [];
  if (positions.length === 0) {
    throw new Error('VALORANT must expose roster positions');
  }

  const now = new Date();
  const at = (offsetMs: number) => new Date(now.getTime() + offsetMs);

  await prisma.tournament.create({
    data: {
      id: UI_SCENARIO_TOURNAMENT_ID,
      name: 'Cúp Valorant Cộng Đồng Việt Nam 2026 – Kịch bản UI',
      slug: UI_SCENARIO_TOURNAMENT_SLUG,
      description:
        'Giải đấu mẫu dành cho kiểm thử lịch thi đấu, check-in, xác nhận kết quả, khiếu nại và phân quyền ban tổ chức.',
      rules:
        'Thi đấu BO3, đúng giờ, sử dụng đội hình đã đăng ký và tuân thủ quyết định của trọng tài.',
      visibility: Visibility.PUBLIC,
      moderationStatus: ModerationStatus.ACTIVE,
      isVerified: true,
      isOfficial: false,
      registrationOpen: false,
      maxTeams: 4,
      startDate: at(-DAY),
      endDate: at(7 * DAY),
      status: TournamentStatus.ONGOING,
      mode: TournamentMode.ONLINE,
      minTeamSize: 5,
      maxTeamSize: 7,
      registrationStartDate: at(-14 * DAY),
      registrationDeadline: at(-2 * DAY),
      autoApproveTeams: false,
      requireMemberFullInfo: true,
      prizePool: '20.000.000 VNĐ',
      contactEmail: UI_SCENARIO_ACCOUNTS.owner.email,
      contactPhone: '0909 123 456',
      contactLink: 'https://discord.gg/arena-ui-test',
      organizerId: UI_SCENARIO_ACCOUNTS.owner.id,
      gameId: game.id,
      createdAt: at(-21 * DAY),
    },
  });

  await prisma.round.create({
    data: {
      id: ROUND_ID,
      tournamentId: UI_SCENARIO_TOURNAMENT_ID,
      name: 'Vòng thử nghiệm nghiệp vụ',
      orderIndex: 1,
      format: RoundFormat.PLAYOFF,
      bestOf: 3,
      settings: { thirdPlaceMatch: false },
      status: RoundStatus.ONGOING,
      createdAt: at(-DAY),
    },
  });

  await createTeam(prisma, {
    id: TEAM_A_ID,
    name: 'Sài Gòn Phượng Hoàng',
    shortName: 'SGP',
    description: 'Đội tuyển cộng đồng trẻ đến từ Thành phố Hồ Chí Minh.',
    captainId: UI_SCENARIO_ACCOUNTS.captainA.id,
    captainName: UI_SCENARIO_ACCOUNTS.captainA.displayName,
    captainEmail: UI_SCENARIO_ACCOUNTS.captainA.email,
    phone: '0912 345 678',
    seed: 1,
    roster: TEAM_A_ROSTER,
    positions,
    now,
  });
  await createTeam(prisma, {
    id: TEAM_B_ID,
    name: 'Hà Nội Hộ Vệ',
    shortName: 'HNG',
    description: 'Đội tuyển bán chuyên quy tụ các tuyển thủ trẻ tại Hà Nội.',
    captainId: UI_SCENARIO_ACCOUNTS.captainB.id,
    captainName: UI_SCENARIO_ACCOUNTS.captainB.displayName,
    captainEmail: UI_SCENARIO_ACCOUNTS.captainB.email,
    phone: '0987 654 321',
    seed: 2,
    roster: TEAM_B_ROSTER,
    positions,
    now,
  });

  await prisma.tournamentStaff.createMany({
    data: [
      {
        id: 'seed-ui-staff-co-organizer',
        tournamentId: UI_SCENARIO_TOURNAMENT_ID,
        userId: UI_SCENARIO_ACCOUNTS.coOrganizer.id,
        role: TournamentStaffRole.CO_ORGANIZER,
      },
      {
        id: 'seed-ui-staff-referee',
        tournamentId: UI_SCENARIO_TOURNAMENT_ID,
        userId: UI_SCENARIO_ACCOUNTS.referee.id,
        role: TournamentStaffRole.REFEREE,
      },
      {
        id: 'seed-ui-staff-scorekeeper',
        tournamentId: UI_SCENARIO_TOURNAMENT_ID,
        userId: UI_SCENARIO_ACCOUNTS.scorekeeper.id,
        role: TournamentStaffRole.SCOREKEEPER,
      },
    ],
  });

  await prisma.match.createMany({
    data: [
      matchData(MATCH_IDS.checkInOpen, 1, MatchStatus.PENDING, at(30 * MINUTE)),
      matchData(MATCH_IDS.checkInLater, 2, MatchStatus.PENDING, at(2 * HOUR)),
      matchData(MATCH_IDS.unscheduled, 3, MatchStatus.PENDING, null),
      matchData(MATCH_IDS.ongoing, 4, MatchStatus.ONGOING, at(-15 * MINUTE), {
        scoreA: 1,
      }),
      matchData(
        MATCH_IDS.pendingReview,
        5,
        MatchStatus.COMPLETED,
        at(-HOUR),
        completedResult(2, 1, TEAM_A_ID, MatchOutcome.TEAM_A, at(-30 * MINUTE)),
      ),
      matchData(
        MATCH_IDS.disputed,
        6,
        MatchStatus.COMPLETED,
        at(-2 * HOUR),
        completedResult(1, 2, TEAM_B_ID, MatchOutcome.TEAM_B, at(-90 * MINUTE)),
      ),
      matchData(
        MATCH_IDS.resolved,
        7,
        MatchStatus.COMPLETED,
        at(-3 * HOUR),
        completedResult(
          2,
          0,
          TEAM_A_ID,
          MatchOutcome.TEAM_A,
          at(-150 * MINUTE),
        ),
      ),
      matchData(
        MATCH_IDS.confirmed,
        8,
        MatchStatus.COMPLETED,
        at(-4 * HOUR),
        completedResult(
          0,
          2,
          TEAM_B_ID,
          MatchOutcome.TEAM_B,
          at(-210 * MINUTE),
        ),
      ),
    ],
  });

  await prisma.matchCheckIn.create({
    data: {
      id: 'seed-ui-check-in-team-a',
      matchId: MATCH_IDS.checkInOpen,
      teamId: TEAM_A_ID,
      checkedInById: UI_SCENARIO_ACCOUNTS.captainA.id,
      checkedInAt: now,
    },
  });

  await prisma.matchResultReview.createMany({
    data: [
      {
        matchId: MATCH_IDS.pendingReview,
        status: MatchResultReviewStatus.PENDING_CONFIRMATION,
        openedAt: at(-25 * MINUTE),
      },
      {
        matchId: MATCH_IDS.disputed,
        status: MatchResultReviewStatus.DISPUTED,
        openedAt: at(-85 * MINUTE),
      },
      {
        matchId: MATCH_IDS.resolved,
        status: MatchResultReviewStatus.RESOLVED,
        openedAt: at(-145 * MINUTE),
        resolvedAt: at(-2 * HOUR),
        resolvedById: UI_SCENARIO_ACCOUNTS.referee.id,
        resolutionNote:
          'Trọng tài đã kiểm tra video và giữ nguyên kết quả đã ghi nhận.',
      },
      {
        matchId: MATCH_IDS.confirmed,
        status: MatchResultReviewStatus.CONFIRMED,
        openedAt: at(-205 * MINUTE),
      },
    ],
  });

  await prisma.matchResultResponse.createMany({
    data: [
      {
        id: 'seed-ui-response-disputed-a',
        reviewMatchId: MATCH_IDS.disputed,
        teamId: TEAM_A_ID,
        respondedById: UI_SCENARIO_ACCOUNTS.captainA.id,
        decision: MatchResultDecision.DISPUTED,
        note: 'Tỷ số map thứ ba chưa khớp với biên bản thi đấu của đội.',
        evidenceUrls: ['https://example.com/bang-chung-tran-dau'],
        respondedAt: at(-80 * MINUTE),
      },
      {
        id: 'seed-ui-response-resolved-a',
        reviewMatchId: MATCH_IDS.resolved,
        teamId: TEAM_A_ID,
        respondedById: UI_SCENARIO_ACCOUNTS.captainA.id,
        decision: MatchResultDecision.DISPUTED,
        note: 'Đội đề nghị trọng tài kiểm tra lại tình huống cuối của map hai.',
        evidenceUrls: ['https://example.com/video-map-2'],
        respondedAt: at(-140 * MINUTE),
      },
      confirmedResponse(
        'seed-ui-response-confirmed-a',
        TEAM_A_ID,
        UI_SCENARIO_ACCOUNTS.captainA.id,
        at(-200 * MINUTE),
      ),
      confirmedResponse(
        'seed-ui-response-confirmed-b',
        TEAM_B_ID,
        UI_SCENARIO_ACCOUNTS.captainB.id,
        at(-195 * MINUTE),
      ),
    ],
  });
}

function matchData(
  id: string,
  matchNumber: number,
  status: MatchStatus,
  scheduledAt: Date | null,
  extra: {
    scoreA?: number;
    scoreB?: number;
    winnerTeamId?: string;
    outcome?: MatchOutcome;
    playedAt?: Date;
  } = {},
) {
  return {
    id,
    roundId: ROUND_ID,
    teamAId: TEAM_A_ID,
    teamBId: TEAM_B_ID,
    matchNumber,
    bracketRound: 1,
    bestOf: 3,
    status,
    scheduledAt,
    discordLink: `https://discord.gg/arena-ui-match-${matchNumber}`,
    scoreA: extra.scoreA ?? 0,
    scoreB: extra.scoreB ?? 0,
    winnerTeamId: extra.winnerTeamId,
    outcome: extra.outcome,
    playedAt: extra.playedAt,
  };
}

function completedResult(
  scoreA: number,
  scoreB: number,
  winnerTeamId: string,
  outcome: MatchOutcome,
  playedAt: Date,
) {
  return { scoreA, scoreB, winnerTeamId, outcome, playedAt };
}

function confirmedResponse(
  id: string,
  teamId: string,
  respondedById: string,
  respondedAt: Date,
) {
  return {
    id,
    reviewMatchId: MATCH_IDS.confirmed,
    teamId,
    respondedById,
    decision: MatchResultDecision.CONFIRMED,
    respondedAt,
  };
}

async function createTeam(
  prisma: PrismaService,
  input: {
    id: string;
    name: string;
    shortName: string;
    description: string;
    captainId: string;
    captainName: string;
    captainEmail: string;
    phone: string;
    seed: number;
    roster: RosterMember[];
    positions: string[];
    now: Date;
  },
) {
  await prisma.team.create({
    data: {
      id: input.id,
      tournamentId: UI_SCENARIO_TOURNAMENT_ID,
      captainId: input.captainId,
      name: input.name,
      shortName: input.shortName,
      description: input.description,
      status: RegistrationStatus.APPROVED,
      seed: input.seed,
      contactName: input.captainName,
      contactEmail: input.captainEmail,
      contactPhone: input.phone,
      reviewedAt: new Date(input.now.getTime() - 2 * DAY),
      registeredAt: new Date(input.now.getTime() - 7 * DAY),
      members: {
        create: input.roster.map((member, index) => ({
          id: `${input.id}-member-${index + 1}`,
          realName: member.realName,
          ign: member.ign,
          inGameId: `${input.shortName}-${String(index + 1).padStart(4, '0')}`,
          birthDate: new Date(`${1998 + index}-05-15T00:00:00.000Z`),
          gender: index % 2 === 0 ? Gender.MALE : Gender.FEMALE,
          email: `${member.ign.toLowerCase()}@doi-tuyen.test`,
          phoneNumber: `09${input.seed}${String(1000000 + index).slice(-7)}`,
          position: input.positions[index % input.positions.length],
          memberRole: index === 0 ? MemberRole.CAPTAIN : MemberRole.PLAYER,
          orderIndex: index,
          userId: member.userId,
          createdAt: new Date(input.now.getTime() - 7 * DAY),
        })),
      },
    },
  });
}
