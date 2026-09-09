import { NestFactory } from '@nestjs/core';
import {
  BannedKeywordCategory,
  Game,
  GamePositionMode,
  Gender,
  MemberRole,
  NotificationType,
  Prisma,
  RegistrationStatus,
  ReportReason,
  ReportStatus,
  RoundFormat,
  RoundStatus,
  TeamInvitationPurpose,
  TeamInvitationStatus,
  TournamentStatus,
} from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { BracketOperationsService } from '../src/brackets/bracket-operations.service';
import { SwissService } from '../src/brackets/swiss.service';
import { syncGameCatalog } from '../src/games/sync-game-catalog';
import { MatchesService } from '../src/matches/matches.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { seedCompetition } from './seed/competition';
import {
  DEVELOPMENT_PASSWORD,
  SEED_EMAIL_DOMAIN,
  SEED_SLUG_PREFIX,
  SEED_TOURNAMENTS,
  SEED_USERS,
  SeedTournamentSpec,
  TEAM_NAMES,
  VIETNAMESE_MEMBER_NAMES,
} from './seed/data';
import { validateSeed } from './seed/validation';

const BCRYPT_ROUNDS = 10;
const PARTICIPANTS = SEED_USERS.filter((user) =>
  ['HYBRID', 'PARTICIPANT'].includes(user.persona),
);
const COMMUNITY_USERS = SEED_USERS.filter(
  (user) => user.role === 'SIGNED_UP_USER',
);
const ORGANIZERS = SEED_USERS.filter((user) =>
  ['ORGANIZER', 'HYBRID'].includes(user.persona),
);
const RESET_CONFIRMATION = 'RESET_LOCAL_ESPORTS_DEV_DB';
const POSTER_BY_GAME: Record<string, string> = {
  LIEN_QUAN_MOBILE: '/images/tournaments/common/posters/arena-of-valor.jpg',
  LEAGUE_OF_LEGENDS: '/images/tournaments/common/posters/league-of-legends.jpg',
  VALORANT: '/images/tournaments/common/posters/valorant.jpg',
  COUNTER_STRIKE_2: '/images/tournaments/common/posters/counter-strike-2.jpg',
  DOTA_2: '/images/tournaments/common/posters/dota-2.jpg',
  MLBB: '/images/tournaments/common/posters/mobile%20legend.jpg',
  HONOR_OF_KINGS: '/images/tournaments/common/posters/honor-of-king.jpg',
  WILD_RIFT: '/images/tournaments/common/posters/wild-rift.jpg',
  FC_ONLINE: '/images/tournaments/common/posters/fc-online.jpg',
  CROSSFIRE_PC: '/images/tournaments/common/posters/crossfire.jpg',
  TEKKEN_8: '/images/tournaments/common/posters/tenken.jpg',
  ROCKET_LEAGUE: '/images/tournaments/common/posters/rocket-league.jpg',
};

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const prisma = app.get(PrismaService);
    if (process.argv.includes('--validate-only')) {
      const summary = await validateSeed(prisma);
      console.log('Dữ liệu phát triển hiện tại hợp lệ.');
      console.log(JSON.stringify(summary, null, 2));
      return;
    }
    if (process.argv.includes('--replace-all')) {
      assertAuthorizedLocalReplacement();
      await cleanOperationalData(prisma);
    } else {
      await cleanOwnedSeedData(prisma);
    }
    await syncGameCatalog(prisma);
    await seedUsers(prisma);
    await ensureBannedKeywords(prisma);

    const games = new Map(
      (await prisma.game.findMany()).map((game) => [game.code, game]),
    );
    const roundsByTournament = new Map<
      string,
      Array<{
        id: string;
        format: RoundFormat;
        orderIndex: number;
        settings: unknown;
      }>
    >();

    for (const [index, tournament] of SEED_TOURNAMENTS.entries()) {
      const game = games.get(tournament.gameCode);
      if (!game)
        throw new Error(`Approved game is missing: ${tournament.gameCode}`);
      roundsByTournament.set(
        tournament.id,
        await seedTournament(prisma, tournament, game, index),
      );
    }

    const competitionServices = {
      prisma,
      brackets: app.get(BracketOperationsService),
      swiss: app.get(SwissService),
      matches: app.get(MatchesService),
    };
    for (const tournament of SEED_TOURNAMENTS) {
      await seedCompetition(
        competitionServices,
        tournament,
        roundsByTournament.get(tournament.id) ?? [],
      );
    }

    await normalizeCompletedMatchDates(prisma);
    await seedPerGameScores(prisma);
    await seedCommunityData(prisma);

    const summary = await validateSeed(prisma);
    console.log('Development seed completed and validated.');
    console.log(`Common development password: ${DEVELOPMENT_PASSWORD}`);
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await app.close();
  }
}

async function normalizeCompletedMatchDates(
  prisma: PrismaService,
): Promise<void> {
  const matches = await prisma.match.findMany({
    where: {
      status: 'COMPLETED',
      round: { tournament: { slug: { startsWith: SEED_SLUG_PREFIX } } },
    },
    select: { id: true, scheduledAt: true },
  });
  for (const match of matches) {
    await prisma.match.update({
      where: { id: match.id },
      data: {
        playedAt: new Date(
          (match.scheduledAt?.getTime() ??
            new Date('2026-01-01T00:00:00.000Z').getTime()) +
            60 * 60 * 1000,
        ),
      },
    });
  }
}

async function seedPerGameScores(prisma: PrismaService): Promise<void> {
  const matches = await prisma.match.findMany({
    where: {
      status: 'COMPLETED',
      isBye: false,
      round: { tournament: { slug: { startsWith: SEED_SLUG_PREFIX } } },
    },
    select: { id: true, scoreA: true, scoreB: true },
  });
  for (const match of matches) {
    const winners = [
      ...Array<'A'>(match.scoreA).fill('A'),
      ...Array<'B'>(match.scoreB).fill('B'),
    ];
    await prisma.matchScore.createMany({
      data: winners.map((winner, index) => ({
        matchId: match.id,
        setNumber: index + 1,
        teamAScore: winner === 'A' ? 13 : 8 + (index % 3),
        teamBScore: winner === 'B' ? 13 : 7 + (index % 4),
      })),
    });
  }
}

async function cleanOwnedSeedData(prisma: PrismaService): Promise<void> {
  await prisma.notification.deleteMany({
    where: {
      OR: [
        { id: { startsWith: 'seed-' } },
        { deduplicationKey: { contains: 'seed-' } },
        { tournament: { slug: { startsWith: SEED_SLUG_PREFIX } } },
      ],
    },
  });
  await prisma.tournamentFavorite.deleteMany({
    where: { tournament: { slug: { startsWith: SEED_SLUG_PREFIX } } },
  });
  await prisma.report.deleteMany({
    where: { tournament: { slug: { startsWith: SEED_SLUG_PREFIX } } },
  });
  await prisma.comment.deleteMany({
    where: {
      tournament: { slug: { startsWith: SEED_SLUG_PREFIX } },
      parentId: { not: null },
    },
  });
  await prisma.comment.deleteMany({
    where: { tournament: { slug: { startsWith: SEED_SLUG_PREFIX } } },
  });
  await prisma.tournament.deleteMany({
    where: { slug: { startsWith: SEED_SLUG_PREFIX } },
  });
}

function assertAuthorizedLocalReplacement(): void {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL chưa được cấu hình.');
  const target = new URL(databaseUrl);
  const database = decodeURIComponent(target.pathname.replace(/^\/+/, ''));
  const allowedHosts = new Set(['localhost', '127.0.0.1', '::1']);
  if (
    !allowedHosts.has(target.hostname.replace(/^\[|\]$/g, '').toLowerCase()) ||
    database !== 'esports_tournament_db' ||
    process.env.NODE_ENV === 'production'
  ) {
    throw new Error(
      'Chỉ được thay toàn bộ dữ liệu của cơ sở dữ liệu phát triển local.',
    );
  }
  if (process.env.CONFIRM_DEV_DB_RESET !== RESET_CONFIRMATION) {
    throw new Error(`Cần đặt CONFIRM_DEV_DB_RESET=${RESET_CONFIRMATION}.`);
  }
}

async function cleanOperationalData(prisma: PrismaService): Promise<void> {
  const gamesBefore = await prisma.game.findMany({ orderBy: { code: 'asc' } });
  const keywordsBefore = await prisma.bannedKeyword.findMany({
    orderBy: { keyword: 'asc' },
  });

  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany();
    await tx.tournamentFavorite.deleteMany();
    await tx.report.deleteMany();
    await tx.comment.deleteMany({ where: { parentId: { not: null } } });
    await tx.comment.deleteMany();
    await tx.teamInvitation.deleteMany();
    await tx.matchScore.deleteMany();
    await tx.match.deleteMany();
    await tx.groupTeam.deleteMany();
    await tx.roundTeam.deleteMany();
    await tx.group.deleteMany();
    await tx.teamMember.deleteMany();
    await tx.team.deleteMany();
    await tx.competitionAuditLog.deleteMany();
    await tx.tournamentAdminOverride.deleteMany();
    await tx.round.deleteMany();
    await tx.tournament.deleteMany();
    await tx.user.deleteMany();
  });

  const [gamesAfter, keywordsAfter] = await Promise.all([
    prisma.game.findMany({ orderBy: { code: 'asc' } }),
    prisma.bannedKeyword.findMany({ orderBy: { keyword: 'asc' } }),
  ]);
  if (
    JSON.stringify(gamesAfter) !== JSON.stringify(gamesBefore) ||
    JSON.stringify(keywordsAfter) !== JSON.stringify(keywordsBefore)
  ) {
    throw new Error(
      'Danh mục game hoặc bộ từ khóa cấm đã bị thay đổi khi làm sạch.',
    );
  }
}

async function seedUsers(prisma: PrismaService): Promise<void> {
  const passwordHash = await bcrypt.hash(DEVELOPMENT_PASSWORD, BCRYPT_ROUNDS);
  const emailVerifiedAt = new Date('2026-01-01T00:00:00.000Z');
  for (const user of SEED_USERS) {
    const profile = {
      passwordHash,
      emailVerifiedAt,
      displayName: user.displayName,
      role: user.role,
      gender: user.gender,
      phoneNumber: user.phoneNumber,
      birthDate: new Date(user.birthDate),
      currentAddress: user.currentAddress,
      bio: user.bio,
      avatarUrl: null,
      isLocked: user.isLocked,
      emailVerificationTokenHash: null,
      emailVerificationExpiresAt: null,
    };
    await prisma.user.upsert({
      where: { id: user.id },
      update: profile,
      create: {
        id: user.id,
        email: user.email,
        ...profile,
        createdAt: new Date('2026-01-01T00:00:00.000Z'),
      },
    });
  }
}

async function ensureBannedKeywords(prisma: PrismaService): Promise<void> {
  await prisma.bannedKeyword.createMany({
    data: [
      { keyword: 'link cá cược', category: BannedKeywordCategory.GAMBLING },
      { keyword: 'nhận kèo', category: BannedKeywordCategory.GAMBLING },
      { keyword: 'dàn xếp tỉ số', category: BannedKeywordCategory.GAMBLING },
      {
        keyword: 'tải phần mềm hack',
        category: BannedKeywordCategory.MALICIOUS_LINK,
      },
      {
        keyword: 'đăng nhập nhận quà',
        category: BannedKeywordCategory.MALICIOUS_LINK,
      },
      { keyword: 'đồ gian lận', category: BannedKeywordCategory.PROFANITY },
    ],
    skipDuplicates: true,
  });
}

async function seedTournament(
  prisma: PrismaService,
  spec: SeedTournamentSpec,
  game: Game,
  tournamentIndex: number,
) {
  const organizer = ORGANIZERS[spec.organizerIndex];
  const activeTeamSize = spec.teamSize ?? game.defaultTeamSize;
  const tournament = await prisma.tournament.create({
    data: {
      id: spec.id,
      name: spec.name,
      slug: spec.slug,
      description: spec.description,
      customGameName: null,
      rules: spec.rules,
      bannerUrl: POSTER_BY_GAME[game.code] ?? null,
      visibility: spec.visibility,
      moderationStatus: spec.moderationStatus,
      isVerified: spec.isVerified,
      isOfficial: spec.isOfficial,
      registrationOpen: spec.status === TournamentStatus.REGISTRATION,
      maxTeams: spec.maxTeams,
      startDate: new Date(spec.startDate),
      endDate: new Date(spec.endDate),
      status:
        spec.competition === 'NONE' ? spec.status : TournamentStatus.ONGOING,
      mode: spec.mode,
      location: spec.location,
      minTeamSize: activeTeamSize,
      maxTeamSize: spec.maxTeamSize,
      minAge: 16,
      maxAge: 35,
      allowedGenders:
        tournamentIndex === 10
          ? ([Gender.FEMALE] as Prisma.InputJsonValue)
          : undefined,
      registrationStartDate: new Date(spec.registrationStartDate),
      registrationDeadline: new Date(spec.registrationDeadline),
      autoApproveTeams: tournamentIndex % 4 === 0,
      requireMemberFullInfo: tournamentIndex % 3 !== 0,
      prizePool: `${20 + tournamentIndex * 5}.000.000 VNĐ`,
      contactEmail: organizer.email,
      contactPhone: organizer.phoneNumber,
      contactLink: `https://discord.gg/dev-seed-${String(tournamentIndex + 1).padStart(2, '0')}`,
      organizerId: organizer.id,
      gameId: game.id,
      createdAt: new Date('2026-01-05T00:00:00.000Z'),
    },
  });

  const totalTeams =
    spec.approvedTeams + spec.pendingTeams + spec.rejectedTeams;
  for (let teamIndex = 0; teamIndex < totalTeams; teamIndex++) {
    await seedTeam(
      prisma,
      tournament.id,
      spec,
      game,
      tournamentIndex,
      teamIndex,
      activeTeamSize,
    );
  }

  const rounds: Array<{
    id: string;
    format: RoundFormat;
    orderIndex: number;
    settings: Prisma.JsonValue;
  }> = [];
  for (const [roundIndex, round] of spec.rounds.entries()) {
    rounds.push(
      await prisma.round.create({
        data: {
          id: `seed-round-${String(tournamentIndex + 1).padStart(2, '0')}-${String(roundIndex + 1).padStart(2, '0')}`,
          tournamentId: tournament.id,
          name: round.name,
          orderIndex: roundIndex + 1,
          format: round.format,
          bestOf: round.bestOf,
          settings: round.settings as unknown as Prisma.InputJsonValue,
          status: RoundStatus.UPCOMING,
          createdAt: new Date('2026-01-06T00:00:00.000Z'),
        },
      }),
    );
  }

  if (spec.visibility === 'PUBLIC' && totalTeams > 0) {
    await prisma.comment.createMany({
      data: [0, 1].map((offset) => ({
        id: `seed-comment-${String(tournamentIndex + 1).padStart(2, '0')}-${offset + 1}`,
        tournamentId: tournament.id,
        authorId:
          PARTICIPANTS[(tournamentIndex + offset) % PARTICIPANTS.length].id,
        content:
          offset === 0
            ? 'Lịch thi đấu được sắp xếp khá hợp lý. Chúc các đội thi đấu thật tốt nhé!'
            : 'Cho mình hỏi trận tiếp theo có được phát trực tiếp trên fanpage không ạ?',
        createdAt: new Date(
          new Date(spec.registrationStartDate).getTime() +
            (offset + 1) * 24 * 60 * 60 * 1000,
        ),
      })),
    });
  }

  return rounds.map((round) => ({
    id: round.id,
    format: round.format,
    orderIndex: round.orderIndex,
    settings: round.settings,
  }));
}

async function seedTeam(
  prisma: PrismaService,
  tournamentId: string,
  tournament: SeedTournamentSpec,
  game: Game,
  tournamentIndex: number,
  teamIndex: number,
  activeTeamSize: number,
): Promise<void> {
  const status = teamRegistrationStatus(tournament, teamIndex);
  const captain =
    PARTICIPANTS[(tournamentIndex * 3 + teamIndex) % PARTICIPANTS.length];
  const teamName = TEAM_NAMES[teamIndex % TEAM_NAMES.length];
  const capacity = tournament.maxTeamSize - activeTeamSize;
  const playerCount =
    activeTeamSize + (capacity === 0 ? 0 : teamIndex % (capacity + 1));
  const registeredAt = new Date(
    new Date(tournament.registrationStartDate).getTime() +
      (teamIndex + 1) * 12 * 60 * 60 * 1000,
  );

  await prisma.team.create({
    data: {
      id: `seed-team-${String(tournamentIndex + 1).padStart(2, '0')}-${String(teamIndex + 1).padStart(2, '0')}`,
      tournamentId,
      captainId: captain.id,
      name: teamName,
      shortName: teamName
        .split(' ')
        .map((part) => part[0])
        .join('')
        .toUpperCase(),
      description: `${teamName} là đội tuyển cộng đồng được tạo để mô phỏng dữ liệu thi đấu tại Việt Nam.`,
      logoUrl: null,
      status,
      seed: status === RegistrationStatus.APPROVED ? teamIndex + 1 : null,
      contactName: captain.displayName,
      contactEmail: captain.email,
      contactPhone: captain.phoneNumber,
      rejectReason:
        status === RegistrationStatus.REJECTED
          ? 'Hồ sơ đội chưa đủ thông tin thành viên trước hạn đăng ký.'
          : null,
      reviewedAt:
        status === RegistrationStatus.PENDING
          ? null
          : new Date(registeredAt.getTime() + 24 * 60 * 60 * 1000),
      registeredAt,
      members: {
        create: buildMembers({
          tournamentIndex,
          teamIndex,
          teamName,
          playerCount,
          activeTeamSize,
          game,
          captain,
          includeCoach:
            status === RegistrationStatus.APPROVED && teamIndex % 2 === 0,
          includeManager:
            status === RegistrationStatus.APPROVED && teamIndex % 3 === 0,
        }),
      },
    },
  });
}

function buildMembers(input: {
  tournamentIndex: number;
  teamIndex: number;
  teamName: string;
  playerCount: number;
  activeTeamSize: number;
  game: Game;
  captain: (typeof PARTICIPANTS)[number];
  includeCoach: boolean;
  includeManager: boolean;
}): Prisma.TeamMemberCreateWithoutTeamInput[] {
  const positions = Array.isArray(input.game.positions)
    ? input.game.positions.filter(
        (position): position is string => typeof position === 'string',
      )
    : [];
  const members: Prisma.TeamMemberCreateWithoutTeamInput[] = Array.from(
    { length: input.playerCount },
    (_, memberIndex) => ({
      id: memberId(input.tournamentIndex, input.teamIndex, memberIndex),
      realName:
        memberIndex === 0
          ? input.captain.displayName
          : vietnameseMemberName(
              input.tournamentIndex,
              input.teamIndex,
              memberIndex,
            ),
      ign: `${input.teamName.split(' ')[0]}${String(memberIndex + 1).padStart(2, '0')}`,
      inGameId: `DEV-${String(input.tournamentIndex + 1).padStart(2, '0')}-${String(input.teamIndex + 1).padStart(2, '0')}-${String(memberIndex + 1).padStart(2, '0')}`,
      birthDate: new Date(
        `${1996 + ((input.teamIndex + memberIndex) % 8)}-${String((memberIndex % 9) + 1).padStart(2, '0')}-12T00:00:00.000Z`,
      ),
      gender: [Gender.MALE, Gender.FEMALE, Gender.OTHER][
        (input.tournamentIndex + input.teamIndex + memberIndex) % 3
      ],
      email:
        memberIndex % 2 === 0
          ? memberEmail(
              memberIndex === 0
                ? input.captain.displayName
                : vietnameseMemberName(
                    input.tournamentIndex,
                    input.teamIndex,
                    memberIndex,
                  ),
              input.tournamentIndex,
              input.teamIndex,
              memberIndex,
            )
          : null,
      phoneNumber:
        memberIndex % 3 === 0
          ? `0912${String(
              (input.tournamentIndex + 1) * 10000 +
                (input.teamIndex + 1) * 100 +
                memberIndex,
            ).padStart(6, '0')}`
          : null,
      position: memberPosition(input.game.positionMode, positions, memberIndex),
      memberRole:
        memberIndex === 0
          ? MemberRole.CAPTAIN
          : memberIndex < input.activeTeamSize
            ? MemberRole.PLAYER
            : MemberRole.SUBSTITUTE,
      avatarUrl: null,
      orderIndex: memberIndex,
      user:
        memberIndex === 0 ? { connect: { id: input.captain.id } } : undefined,
      createdAt: new Date('2026-01-07T00:00:00.000Z'),
    }),
  );

  if (input.includeCoach) {
    members.push(
      staffMember(input, MemberRole.COACH, members.length, 'Huấn luyện viên'),
    );
  }
  if (input.includeManager) {
    members.push(
      staffMember(input, MemberRole.MANAGER, members.length, 'Quản lý'),
    );
  }
  return members;
}

function staffMember(
  input: Parameters<typeof buildMembers>[0],
  role: typeof MemberRole.COACH | typeof MemberRole.MANAGER,
  orderIndex: number,
  label: string,
): Prisma.TeamMemberCreateWithoutTeamInput {
  return {
    id: memberId(input.tournamentIndex, input.teamIndex, orderIndex),
    realName: vietnameseMemberName(
      input.tournamentIndex,
      input.teamIndex,
      orderIndex,
    ),
    ign: `${input.teamName.split(' ')[0]}${label}`,
    inGameId: null,
    birthDate: new Date('1990-06-15T00:00:00.000Z'),
    gender: Gender.OTHER,
    email: null,
    phoneNumber: null,
    position: null,
    memberRole: role,
    avatarUrl: null,
    orderIndex,
    createdAt: new Date('2026-01-07T00:00:00.000Z'),
  };
}

async function seedCommunityData(prisma: PrismaService): Promise<void> {
  const publicTournaments = SEED_TOURNAMENTS.filter(
    (tournament) => tournament.visibility === 'PUBLIC',
  );
  const activityDate = (offset: number, hour = 8) =>
    new Date(
      new Date('2026-08-02T00:00:00.000Z').getTime() +
        offset * 24 * 60 * 60 * 1000 +
        hour * 60 * 60 * 1000,
    );

  await prisma.tournamentFavorite.createMany({
    data: COMMUNITY_USERS.flatMap((user, index) =>
      [0, 1].map((offset) => ({
        userId: user.id,
        tournamentId:
          publicTournaments[
            (index * 5 + offset * 11) % publicTournaments.length
          ].id,
        createdAt: activityDate(index % 35, 7 + offset),
      })),
    ),
  });

  const rootComments = await Promise.all(
    COMMUNITY_USERS.map((author, index) => {
      const tournament =
        publicTournaments[(index * 7) % publicTournaments.length];
      return prisma.comment.create({
        data: {
          id: `seed-community-comment-${String(index + 1).padStart(3, '0')}`,
          content: [
            'Lịch thi đấu được sắp xếp hợp lý, chúc các đội thi đấu thật tốt.',
            'Ban tổ chức cho mình hỏi các trận sắp tới có phát trực tiếp không?',
            'Thể thức của giải lần này khá hấp dẫn, mình sẽ theo dõi đến chung kết.',
            'Thông tin đội tuyển và thời gian thi đấu được trình bày rất dễ theo dõi.',
            'Mong ban tổ chức cập nhật kết quả ngay sau khi trận đấu kết thúc.',
          ][index % 5],
          authorId: author.id,
          tournamentId: tournament.id,
          isHidden: index % 47 === 0,
          deletedAt: index % 73 === 0 ? activityDate(index % 35, 14) : null,
          createdAt: activityDate(index % 35, 10),
        },
      });
    }),
  );

  for (let index = 0; index < 90; index++) {
    const root = rootComments[(index * 11) % rootComments.length];
    const replyAuthor =
      COMMUNITY_USERS[(index * 17 + 9) % COMMUNITY_USERS.length];
    const rootAuthor = COMMUNITY_USERS[(index * 11) % COMMUNITY_USERS.length];
    const replyId = `seed-community-reply-${String(index + 1).padStart(3, '0')}`;
    await prisma.comment.create({
      data: {
        id: replyId,
        content: [
          'Mình cũng đang chờ trận này, hai đội có phong độ khá cân bằng.',
          'Theo thông báo mới nhất thì lịch vẫn được giữ nguyên bạn nhé.',
          'Cảm ơn bạn, mình đã thêm giải vào danh sách theo dõi.',
          'Ban tổ chức đã cập nhật đường dẫn phát trực tiếp trong phần thông tin.',
        ][index % 4],
        authorId: replyAuthor.id,
        tournamentId: root.tournamentId,
        parentId: root.id,
        replyToUserId: rootAuthor.id,
        createdAt: activityDate(index % 35, 12),
      },
    });
    await prisma.notification.create({
      data: {
        id: `seed-notification-reply-${String(index + 1).padStart(3, '0')}`,
        userId: rootAuthor.id,
        tournamentId: root.tournamentId,
        type: NotificationType.COMMENT_REPLY,
        content: `${replyAuthor.displayName} đã trả lời bình luận của bạn`,
        data: {
          kind: 'COMMENT_REPLY',
          rootCommentId: root.id,
          replyCommentId: replyId,
        },
        deduplicationKey: `seed:comment-reply:${replyId}`,
        isRead: index % 3 === 0,
        createdAt: activityDate(index % 35, 12),
      },
    });
  }

  const reportReasons = [
    ReportReason.SPAM_OR_MALICIOUS_LINKS,
    ReportReason.HARASSMENT_OR_HATE,
    ReportReason.INAPPROPRIATE_CONTENT,
    ReportReason.SCAM,
    ReportReason.OTHER,
    ReportReason.GAMBLING,
  ];
  const reportDescriptions = [
    'Phần mô tả có đường dẫn quảng cáo không liên quan đến giải đấu.',
    'Một số nội dung trao đổi có lời lẽ thiếu tôn trọng người tham gia.',
    'Ảnh đại diện của giải chưa phù hợp với cộng đồng.',
    'Thông tin phần thưởng có dấu hiệu gây hiểu nhầm cho người đăng ký.',
    'Lịch thi đấu thay đổi nhiều lần nhưng chưa có thông báo rõ ràng.',
    'Nội dung giải có nhắc đến hoạt động cá cược.',
  ];
  await prisma.report.createMany({
    data: Array.from({ length: 60 }, (_, index) => {
      const reason = reportReasons[index % reportReasons.length];
      const status = [
        ReportStatus.PENDING,
        ReportStatus.REVIEWED,
        ReportStatus.DISMISSED,
      ][index % 3];
      return {
        id: `seed-report-${String(index + 1).padStart(3, '0')}`,
        tournamentId: publicTournaments[(index * 3) % 14].id,
        reporterUserId:
          COMMUNITY_USERS[(index * 17) % COMMUNITY_USERS.length].id,
        reason,
        description: reportDescriptions[index % reportDescriptions.length],
        status,
        reviewedBy:
          status === ReportStatus.PENDING ? null : SEED_USERS[index % 3].id,
        reviewedAt:
          status === ReportStatus.PENDING ? null : activityDate(index % 35, 16),
        createdAt: activityDate(index % 35, 15),
      };
    }),
  });

  await prisma.notification.createMany({
    data: COMMUNITY_USERS.map((user, index) => {
      const tournament =
        publicTournaments[(index * 13) % publicTournaments.length];
      return {
        id: `seed-notification-tournament-${String(index + 1).padStart(3, '0')}`,
        userId: user.id,
        tournamentId: tournament.id,
        type:
          index % 2 === 0
            ? NotificationType.SCHEDULE_CHANGE
            : NotificationType.TOURNAMENT_STATUS,
        content:
          index % 2 === 0
            ? 'Lịch thi đấu vừa được ban tổ chức cập nhật'
            : 'Trạng thái giải đấu vừa thay đổi',
        data:
          index % 2 === 0
            ? { kind: 'MATCH_SCHEDULE', tournamentName: tournament.name }
            : { kind: 'TOURNAMENT_STATUS', status: tournament.status },
        deduplicationKey: `seed:tournament-notification:${index + 1}`,
        isRead: index % 4 === 0,
        createdAt: activityDate(index % 35, 13),
      };
    }),
  });

  const invitationTeams = await prisma.team.findMany({
    where: { tournament: { slug: { startsWith: SEED_SLUG_PREFIX } } },
    include: {
      tournament: { select: { organizerId: true } },
      members: { take: 1 },
    },
    orderBy: { id: 'asc' },
    take: 80,
  });
  await prisma.teamInvitation.createMany({
    data: invitationTeams.map((team, index) => {
      const invitee =
        COMMUNITY_USERS[(index * 19 + 5) % COMMUNITY_USERS.length];
      const status = [
        TeamInvitationStatus.ACCEPTED,
        TeamInvitationStatus.PENDING,
        TeamInvitationStatus.REVOKED,
        TeamInvitationStatus.EXPIRED,
      ][index % 4];
      const createdAt = activityDate(index % 30, 9);
      return {
        id: `seed-invitation-${String(index + 1).padStart(3, '0')}`,
        purpose: TeamInvitationPurpose.MEMBER_LINK,
        status,
        email: invitee.email,
        tokenHash: `ma-moi-du-lieu-${String(index + 1).padStart(3, '0')}`,
        expiresAt: new Date(
          createdAt.getTime() +
            (status === TeamInvitationStatus.EXPIRED ? 1 : 14) * 86_400_000,
        ),
        acceptedAt:
          status === TeamInvitationStatus.ACCEPTED
            ? new Date(createdAt.getTime() + 86_400_000)
            : null,
        revokedAt:
          status === TeamInvitationStatus.REVOKED
            ? new Date(createdAt.getTime() + 86_400_000)
            : null,
        tournamentId: team.tournamentId,
        teamId: team.id,
        memberId: team.members[0]?.id ?? null,
        invitedById: team.tournament.organizerId,
        acceptedById:
          status === TeamInvitationStatus.ACCEPTED ? invitee.id : null,
        createdAt,
      };
    }),
  });
}

function vietnameseMemberName(
  tournamentIndex: number,
  teamIndex: number,
  memberIndex: number,
): string {
  return VIETNAMESE_MEMBER_NAMES[
    (tournamentIndex * 7 + teamIndex * 3 + memberIndex) %
      VIETNAMESE_MEMBER_NAMES.length
  ];
}

function memberEmail(
  name: string,
  tournamentIndex: number,
  teamIndex: number,
  memberIndex: number,
): string {
  const localPart = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.|\.$/g, '');
  return `${localPart}.${tournamentIndex + 1}${teamIndex + 1}${memberIndex + 1}@${SEED_EMAIL_DOMAIN}`;
}

function memberPosition(
  mode: GamePositionMode,
  positions: string[],
  memberIndex: number,
): string | null {
  if (mode === GamePositionMode.NONE || positions.length === 0) return null;
  if (mode === GamePositionMode.OPTIONAL && memberIndex % 2 === 1) return null;
  return positions[memberIndex % positions.length];
}

function teamRegistrationStatus(
  tournament: SeedTournamentSpec,
  teamIndex: number,
): RegistrationStatus {
  if (teamIndex < tournament.approvedTeams) return RegistrationStatus.APPROVED;
  if (teamIndex < tournament.approvedTeams + tournament.pendingTeams) {
    return RegistrationStatus.PENDING;
  }
  return RegistrationStatus.REJECTED;
}

function memberId(
  tournamentIndex: number,
  teamIndex: number,
  memberIndex: number,
): string {
  return `seed-member-${String(tournamentIndex + 1).padStart(2, '0')}-${String(teamIndex + 1).padStart(2, '0')}-${String(memberIndex + 1).padStart(2, '0')}`;
}

main().catch((error: unknown) => {
  console.error('Development seed failed:', error);
  process.exit(1);
});
