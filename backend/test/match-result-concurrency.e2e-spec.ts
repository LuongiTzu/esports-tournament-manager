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
        name: `BE6 Test Game ${stamp}`,
        defaultTeamSize: 1,
        minTeamSize: 1,
        maxTeamSize: 1,
      },
    });
    gameId = game.id;
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

  async function fixture(label: string) {
    const tournament = await prisma.tournament.create({
      data: {
        name: `BE6 ${label} ${stamp}`,
        slug: `be6-${label.toLowerCase()}-${stamp}`,
        gameId,
        organizerId,
        minTeamSize: 1,
        maxTeamSize: 1,
        status: 'ONGOING',
      },
    });
    tournamentIds.push(tournament.id);
    const round = await prisma.round.create({
      data: {
        name: 'Playoff',
        orderIndex: 1,
        format: RoundFormat.PLAYOFF,
        bestOf: 1,
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
          },
        }),
      ),
    );
    const final = await prisma.match.create({
      data: {
        roundId: round.id,
        teamBId: teams[2].id,
        bestOf: 1,
        bracketRound: 2,
        matchNumber: 1,
      },
    });
    const source = await prisma.match.create({
      data: {
        roundId: round.id,
        teamAId: teams[0].id,
        teamBId: teams[1].id,
        bestOf: 1,
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
});
