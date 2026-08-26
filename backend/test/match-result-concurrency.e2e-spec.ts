import { Test } from '@nestjs/testing';
import {
  MatchOutcome,
  MatchSlot,
  MatchStatus,
  RoundFormat,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { MatchesService } from '../src/matches/matches.service';
import { PrismaService } from '../src/prisma/prisma.service';

const describeDatabase =
  process.env.RUN_DATABASE_E2E === 'true' ? describe : describe.skip;

describeDatabase('match result concurrency (database E2E)', () => {
  let prisma: PrismaService;
  let matches: MatchesService;
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const tournamentIds: string[] = [];
  const userIds: string[] = [];
  let gameId: string;
  let fcOnlineGameId: string;
  let customGameId: string;
  let organizerId: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    prisma = moduleRef.get(PrismaService);
    matches = moduleRef.get(MatchesService);

    const organizer = await prisma.user.create({
      data: {
        email: `be6-organizer-${stamp}@example.test`,
        passwordHash: 'not-used-by-this-test',
        displayName: 'BE6 Organizer',
      },
    });
    organizerId = organizer.id;
    userIds.push(organizer.id);
    const game = await prisma.game.create({
      data: {
        code: `BE6_TEST_${stamp}`,
        name: `BE6 Test Game ${stamp}`,
        defaultTeamSize: 1,
        minTeamSize: 1,
        maxTeamSize: 1,
      },
    });
    gameId = game.id;

    const canonicalGames = await prisma.game.findMany({
      where: { code: { in: ['FC_ONLINE', 'CUSTOM'] } },
      select: { id: true, code: true },
    });
    const idsByCode = new Map(
      canonicalGames.map((catalogGame) => [catalogGame.code, catalogGame.id]),
    );
    fcOnlineGameId = requireGameId(idsByCode, 'FC_ONLINE');
    customGameId = requireGameId(idsByCode, 'CUSTOM');
  });

  afterAll(async () => {
    if (prisma) {
      await prisma.notification.deleteMany({
        where: { tournamentId: { in: tournamentIds } },
      });
      await prisma.tournament.deleteMany({
        where: { id: { in: tournamentIds } },
      });
      await prisma.user.deleteMany({ where: { id: { in: userIds } } });
      if (gameId) await prisma.game.deleteMany({ where: { id: gameId } });
      await prisma.$disconnect();
    }
  });

  async function fixture(
    label: string,
    options: {
      gameId?: string;
      minTeamSize?: number;
      maxTeamSize?: number;
      bestOf?: number;
      customGameName?: string;
    } = {},
  ) {
    const minTeamSize = options.minTeamSize ?? 1;
    const bestOf = options.bestOf ?? 1;
    const tournament = await prisma.tournament.create({
      data: {
        name: `BE6 ${label} ${stamp}`,
        slug: `be6-${label.toLowerCase()}-${stamp}`,
        gameId: options.gameId ?? gameId,
        organizerId,
        minTeamSize,
        maxTeamSize: options.maxTeamSize ?? minTeamSize,
        customGameName: options.customGameName,
        status: 'ONGOING',
      },
    });
    tournamentIds.push(tournament.id);
    const round = await prisma.round.create({
      data: {
        name: 'Playoff',
        orderIndex: 1,
        format: RoundFormat.PLAYOFF,
        bestOf,
        status: 'ONGOING',
        tournamentId: tournament.id,
      },
    });
    const captains = await Promise.all(
      ['A', 'B', 'C'].map(async (suffix) => {
        const user = await prisma.user.create({
          data: {
            email: `be6-${label}-${suffix}-${stamp}@example.test`,
            passwordHash: 'not-used-by-this-test',
            displayName: `BE6 ${label} ${suffix}`,
          },
        });
        userIds.push(user.id);
        return user;
      }),
    );
    const teams = await Promise.all(
      captains.map((captain, index) =>
        prisma.team.create({
          data: {
            name: `BE6 ${label} Team ${index} ${stamp}`,
            contactName: captain.displayName,
            contactEmail: captain.email,
            captainId: captain.id,
            tournamentId: tournament.id,
            status: 'APPROVED',
            members: {
              create: Array.from({ length: minTeamSize }, (_, memberIndex) => ({
                realName: `BE6 ${label} ${index} Member ${memberIndex}`,
                ign: `be6-${label}-${index}-${memberIndex}-${stamp}`,
                memberRole: memberIndex === 0 ? 'CAPTAIN' : 'PLAYER',
                userId: memberIndex === 0 ? captain.id : undefined,
                orderIndex: memberIndex,
              })),
            },
          },
        }),
      ),
    );
    const final = await prisma.match.create({
      data: {
        roundId: round.id,
        teamBId: teams[2].id,
        bestOf,
        bracketRound: 2,
        matchNumber: 1,
      },
    });
    const source = await prisma.match.create({
      data: {
        roundId: round.id,
        teamAId: teams[0].id,
        teamBId: teams[1].id,
        bestOf,
        bracketRound: 1,
        matchNumber: 1,
        nextMatchId: final.id,
        nextMatchSlot: MatchSlot.A,
      },
    });
    return { source, final, teams };
  }

  async function assertCanonicalProgression(sourceId: string, finalId: string) {
    const source = await prisma.match.findUniqueOrThrow({
      where: { id: sourceId },
    });
    const final = await prisma.match.findUniqueOrThrow({
      where: { id: finalId },
    });
    expect(source.status).toBe(MatchStatus.COMPLETED);
    expect(final.teamAId).toBe(source.winnerTeamId);
    expect(source.outcome).toBe(
      source.winnerTeamId === source.teamAId
        ? MatchOutcome.TEAM_A
        : MatchOutcome.TEAM_B,
    );
    expect(source.scoreA + source.scoreB).toBe(1);
  }

  it('serializes competing initial results without corrupting progression', async () => {
    const { source, final } = await fixture('Initial');

    const results = await Promise.allSettled([
      matches.update(source.id, {
        scoreA: 1,
        scoreB: 0,
        status: MatchStatus.COMPLETED,
      }),
      matches.update(source.id, {
        scoreA: 0,
        scoreB: 1,
        status: MatchStatus.COMPLETED,
      }),
    ]);

    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
    await assertCanonicalProgression(source.id, final.id);
  });

  it('serializes competing corrections against the authoritative locked state', async () => {
    const { source, final } = await fixture('Correction');
    await matches.update(source.id, {
      scoreA: 1,
      scoreB: 0,
      status: MatchStatus.COMPLETED,
    });

    const results = await Promise.allSettled([
      matches.update(source.id, {
        scoreA: 0,
        scoreB: 1,
        status: MatchStatus.COMPLETED,
      }),
      matches.update(source.id, {
        scoreA: 1,
        scoreB: 0,
        status: MatchStatus.COMPLETED,
      }),
    ]);

    expect(results.every((result) => result.status === 'fulfilled')).toBe(true);
    await assertCanonicalProgression(source.id, final.id);
  });

  it('records an FC Online individual match as ordinary Team-vs-Team BO1', async () => {
    const { source, final, teams } = await fixture('FCIndividual', {
      gameId: fcOnlineGameId,
      minTeamSize: 1,
      maxTeamSize: 1,
    });

    await matches.update(source.id, {
      scoreA: 1,
      scoreB: 0,
      status: MatchStatus.COMPLETED,
    });

    await assertCanonicalProgression(source.id, final.id);
    expect(
      await prisma.teamMember.count({
        where: { teamId: { in: teams.map((team) => team.id) } },
      }),
    ).toBe(3);
  });

  it('records a Custom 5v5 BO3 and advances the winning Team unchanged', async () => {
    const { source, final, teams } = await fixture('Custom5v5', {
      gameId: customGameId,
      minTeamSize: 5,
      maxTeamSize: 7,
      bestOf: 3,
      customGameName: 'GF-4 Custom Fixture',
    });

    const updated = await matches.putScores(source.id, {
      scores: [
        { setNumber: 1, teamAScore: 10, teamBScore: 5 },
        { setNumber: 2, teamAScore: 5, teamBScore: 10 },
        { setNumber: 3, teamAScore: 10, teamBScore: 5 },
      ],
    });
    const downstream = await prisma.match.findUniqueOrThrow({
      where: { id: final.id },
    });

    expect(updated).toMatchObject({
      status: MatchStatus.COMPLETED,
      scoreA: 2,
      scoreB: 1,
      winnerTeamId: teams[0].id,
      outcome: MatchOutcome.TEAM_A,
    });
    expect(downstream.teamAId).toBe(teams[0].id);
    expect(
      await prisma.teamMember.count({
        where: { teamId: { in: teams.map((team) => team.id) } },
      }),
    ).toBe(15);
  });
});

function requireGameId(idsByCode: Map<string, string>, code: string): string {
  const id = idsByCode.get(code);
  if (!id) {
    throw new Error(
      `Missing canonical game ${code}; run the safe catalog synchronization first`,
    );
  }
  return id;
}
