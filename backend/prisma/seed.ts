import { NestFactory } from '@nestjs/core';
import {
  BannedKeywordCategory,
  Game,
  GamePositionMode,
  Gender,
  MemberRole,
  ModerationStatus,
  Prisma,
  RegistrationStatus,
  RoundFormat,
  RoundStatus,
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
  TEAM_NAME_PREFIXES,
  TEAM_NAME_SUFFIXES,
} from './seed/data';
import { validateSeed } from './seed/validation';

const BCRYPT_ROUNDS = 10;
const PARTICIPANTS = SEED_USERS.filter(
  (user) => user.persona === 'PARTICIPANT',
);
const ORGANIZERS = SEED_USERS.filter((user) => user.persona === 'ORGANIZER');

async function main(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
  });

  try {
    const prisma = app.get(PrismaService);
    await cleanOwnedSeedData(prisma);
    await syncGameCatalog(prisma);
    await seedUsers(prisma);
    await seedBannedKeywords(prisma);

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

async function cleanOwnedSeedData(prisma: PrismaService): Promise<void> {
  await prisma.tournament.deleteMany({
    where: { slug: { startsWith: SEED_SLUG_PREFIX } },
  });
}

async function seedUsers(prisma: PrismaService): Promise<void> {
  const passwordHash = await bcrypt.hash(DEVELOPMENT_PASSWORD, BCRYPT_ROUNDS);
  for (const user of SEED_USERS) {
    const profile = {
      passwordHash,
      displayName: user.displayName,
      role: user.role,
      gender: user.gender,
      phoneNumber: user.phoneNumber,
      birthDate: new Date(user.birthDate),
      currentAddress: user.currentAddress,
      bio: user.bio,
      avatarUrl: null,
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

async function seedBannedKeywords(prisma: PrismaService): Promise<void> {
  await prisma.bannedKeyword.deleteMany();
  await prisma.bannedKeyword.createMany({
    data: [
      { keyword: 'betting link', category: BannedKeywordCategory.GAMBLING },
      { keyword: 'casino offer', category: BannedKeywordCategory.GAMBLING },
      { keyword: 'match fixing', category: BannedKeywordCategory.GAMBLING },
      {
        keyword: 'malware download',
        category: BannedKeywordCategory.MALICIOUS_LINK,
      },
      {
        keyword: 'phishing login',
        category: BannedKeywordCategory.MALICIOUS_LINK,
      },
      { keyword: 'abusive phrase', category: BannedKeywordCategory.PROFANITY },
    ],
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
      customGameName: spec.customGameName,
      rules:
        'Respect scheduled match times, use registered rosters, and follow organizer rulings.',
      bannerUrl: null,
      visibility: spec.visibility,
      moderationStatus:
        spec.status === TournamentStatus.CANCELLED
          ? ModerationStatus.HIDDEN_BY_ADMIN
          : ModerationStatus.ACTIVE,
      isVerified: tournamentIndex % 3 !== 1,
      registrationOpen: spec.status === TournamentStatus.REGISTRATION,
      maxTeams: spec.maxTeams,
      startDate: new Date(spec.startDate),
      endDate: new Date(spec.endDate),
      status: spec.status,
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
      prizePool: `${20 + tournamentIndex * 5},000,000 VND total fictional prize pool`,
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
            ? 'The schedule and format look clear. Good luck to every fictional team!'
            : 'Looking forward to the next seeded match day.',
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
  const prefix = TEAM_NAME_PREFIXES[teamIndex % TEAM_NAME_PREFIXES.length];
  const suffix =
    TEAM_NAME_SUFFIXES[
      (tournamentIndex + teamIndex * 2) % TEAM_NAME_SUFFIXES.length
    ];
  const teamName = `${prefix} ${suffix}`;
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
      shortName: `${prefix.slice(0, 3).toUpperCase()}${teamIndex + 1}`,
      description: `${teamName} is a fictional roster created for development testing.`,
      logoUrl: null,
      status,
      seed: status === RegistrationStatus.APPROVED ? teamIndex + 1 : null,
      contactName: captain.displayName,
      contactEmail: captain.email,
      contactPhone: captain.phoneNumber,
      rejectReason:
        status === RegistrationStatus.REJECTED
          ? 'Registration details were incomplete before the fictional deadline.'
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
          : `Fictional Player ${input.tournamentIndex + 1}-${input.teamIndex + 1}-${memberIndex + 1}`,
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
          ? `member.${input.tournamentIndex + 1}.${input.teamIndex + 1}.${memberIndex + 1}@${SEED_EMAIL_DOMAIN}`
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
    members.push(staffMember(input, MemberRole.COACH, members.length, 'Coach'));
  }
  if (input.includeManager) {
    members.push(
      staffMember(input, MemberRole.MANAGER, members.length, 'Manager'),
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
    realName: `Fictional ${label} ${input.tournamentIndex + 1}-${input.teamIndex + 1}`,
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
