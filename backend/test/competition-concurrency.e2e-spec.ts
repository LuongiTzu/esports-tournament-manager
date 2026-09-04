import { Test } from '@nestjs/testing';
import {
  MatchOutcome,
  MatchStatus,
  RoundFormat,
  TournamentStatus,
} from '@prisma/client';
import { AppModule } from '../src/app.module';
import { BracketOperationsService } from '../src/brackets/bracket-operations.service';
import { SwissService } from '../src/brackets/swiss.service';
import { MatchesService } from '../src/matches/matches.service';
import { PrismaService } from '../src/prisma/prisma.service';
import { TournamentsService } from '../src/tournaments/tournaments.service';

const describeDatabase =
  process.env.RUN_DATABASE_E2E === 'true' ? describe : describe.skip;

describeDatabase('competition workflows and concurrency (database E2E)', () => {
  let prisma: PrismaService;
  let brackets: BracketOperationsService;
  let matches: MatchesService;
  let tournaments: TournamentsService;
  let swiss: SwissService;
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
    brackets = moduleRef.get(BracketOperationsService);
    matches = moduleRef.get(MatchesService);
    tournaments = moduleRef.get(TournamentsService);
    swiss = moduleRef.get(SwissService);
    const organizer = await prisma.user.create({
      data: {
        email: `be7-organizer-${stamp}@example.test`,
        passwordHash: 'not-used-by-this-test',
        displayName: 'BE7 Organizer',
      },
    });
    organizerId = organizer.id;
    userIds.push(organizer.id);
    const game = await prisma.game.create({
      data: {
        code: `BE7_TEST_${stamp}`,
        name: `BE7 Test Game ${stamp}`,
        defaultTeamSize: 1,
        minTeamSize: 1,
        maxTeamSize: 1,
      },
    });
    gameId = game.id;
  });

  afterAll(async () => {
    if (!prisma) return;
    await prisma.notification.deleteMany({
      where: { tournamentId: { in: tournamentIds } },
    });
    await prisma.tournament.deleteMany({
      where: { id: { in: tournamentIds } },
    });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    if (gameId) await prisma.game.deleteMany({ where: { id: gameId } });
    await prisma.$disconnect();
  });

  async function tournamentFixture(label: string, teamCount = 4) {
    const tournament = await prisma.tournament.create({
      data: {
        name: `BE7 ${label} ${stamp}`,
        slug: `be7-${label.toLowerCase()}-${stamp}`,
        gameId,
        organizerId,
        minTeamSize: 1,
        maxTeamSize: 1,
        status: TournamentStatus.ONGOING,
        registrationOpen: false,
      },
    });
    tournamentIds.push(tournament.id);
    const teams = await Promise.all(
      Array.from({ length: teamCount }, async (_, index) => {
        const user = await prisma.user.create({
          data: {
            email: `be7-${label}-${index}-${stamp}@example.test`,
            passwordHash: 'not-used-by-this-test',
            displayName: `BE7 ${label} ${index}`,
          },
        });
        userIds.push(user.id);
        return prisma.team.create({
          data: {
            name: `BE7 ${label} Team ${index} ${stamp}`,
            contactName: user.displayName,
            contactEmail: user.email,
            captainId: user.id,
            tournamentId: tournament.id,
            status: 'APPROVED',
            seed: index + 1,
          },
        });
      }),
    );
    return { tournament, teams };
  }

  it('serializes concurrent bracket generation into one canonical match set', async () => {
    const { tournament } = await tournamentFixture('Generation');
    const round = await prisma.round.create({
      data: {
        name: 'Playoff',
        orderIndex: 1,
        format: RoundFormat.PLAYOFF,
        bestOf: 1,
        tournamentId: tournament.id,
        settings: { thirdPlaceMatch: false },
      },
    });
    const results = await Promise.allSettled([
      brackets.generate(round.id),
      brackets.generate(round.id),
    ]);
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      results.filter((result) => result.status === 'rejected'),
    ).toHaveLength(1);
    expect(await prisma.match.count({ where: { roundId: round.id } })).toBe(3);
    expect(await prisma.group.count({ where: { roundId: round.id } })).toBe(0);
    expect(
      await prisma.groupTeam.count({ where: { group: { roundId: round.id } } }),
    ).toBe(0);
  });

  it('serializes concurrent add-round commands into distinct sequential order indexes', async () => {
    const { tournament } = await tournamentFixture('AddRound', 0);
    await prisma.round.create({
      data: {
        name: 'Existing',
        orderIndex: 1,
        format: RoundFormat.ROUND_ROBIN,
        bestOf: 1,
        tournamentId: tournament.id,
      },
    });
    const results = await Promise.all([
      tournaments.addRound(tournament.id, {
        name: 'Second',
        format: RoundFormat.ROUND_ROBIN,
        bestOf: 1,
        settings: { advancingTeamCount: 2 },
      }),
      tournaments.addRound(tournament.id, {
        name: 'Third',
        format: RoundFormat.ROUND_ROBIN,
        bestOf: 1,
        settings: { advancingTeamCount: 2 },
      }),
    ]);
    expect(results.map((round) => round.orderIndex).sort()).toEqual([2, 3]);
    const persisted = await prisma.round.findMany({
      where: { tournamentId: tournament.id },
      orderBy: { orderIndex: 'asc' },
      select: { orderIndex: true },
    });
    expect(persisted.map((round) => round.orderIndex)).toEqual([1, 2, 3]);
  });

  it('persists the complete Double Elimination Grand Final Reset workflow', async () => {
    const { tournament } = await tournamentFixture('DoubleElim');
    const round = await prisma.round.create({
      data: {
        name: 'Double Elimination',
        orderIndex: 1,
        format: RoundFormat.DOUBLE_ELIM,
        bestOf: 1,
        status: 'ONGOING',
        tournamentId: tournament.id,
        settings: { grandFinalReset: true },
      },
    });
    await brackets.generate(round.id);
    let resetActivated = false;
    for (let step = 0; step < 30; step++) {
      const candidates = await prisma.match.findMany({
        where: {
          roundId: round.id,
          status: MatchStatus.PENDING,
          isActive: true,
          teamAId: { not: null },
          teamBId: { not: null },
        },
        orderBy: [{ bracketRound: 'asc' }, { matchNumber: 'asc' }],
      });
      if (!candidates.length) break;
      const current = candidates[0];
      const isGrandFinal =
        current.nextMatchId !== null &&
        current.nextMatchId === current.loserNextMatchId;
      await matches.update(current.id, {
        scoreA: isGrandFinal ? 0 : 1,
        scoreB: isGrandFinal ? 1 : 0,
        status: MatchStatus.COMPLETED,
      });
      if (isGrandFinal) {
        const reset = await prisma.match.findUniqueOrThrow({
          where: { id: current.nextMatchId! },
        });
        expect(reset.isActive).toBe(true);
        expect(reset.teamAId).toBe(current.teamBId);
        expect(reset.teamBId).toBe(current.teamAId);

        await matches.update(current.id, {
          scoreA: 1,
          scoreB: 0,
          status: MatchStatus.COMPLETED,
        });
        const rolledBackReset = await prisma.match.findUniqueOrThrow({
          where: { id: reset.id },
        });
        expect(rolledBackReset).toMatchObject({
          isActive: false,
          teamAId: null,
          teamBId: null,
          status: MatchStatus.PENDING,
        });
        await expect(
          prisma.tournament.findUniqueOrThrow({
            where: { id: tournament.id },
            select: { status: true },
          }),
        ).resolves.toEqual({ status: TournamentStatus.COMPLETED });

        await matches.update(current.id, {
          scoreA: 0,
          scoreB: 1,
          status: MatchStatus.COMPLETED,
        });
        const reactivatedReset = await prisma.match.findUniqueOrThrow({
          where: { id: reset.id },
        });
        expect(reactivatedReset).toMatchObject({
          isActive: true,
          teamAId: current.teamBId,
          teamBId: current.teamAId,
          status: MatchStatus.PENDING,
        });
        await expect(
          prisma.tournament.findUniqueOrThrow({
            where: { id: tournament.id },
            select: { status: true },
          }),
        ).resolves.toEqual({ status: TournamentStatus.ONGOING });
        resetActivated = true;
      }
    }
    expect(resetActivated).toBe(true);
    const reset = await prisma.match.findFirstOrThrow({
      where: {
        roundId: round.id,
        activationCondition: 'LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL',
      },
    });
    expect(reset.status).toBe(MatchStatus.COMPLETED);
    expect(reset.outcome).toBe(MatchOutcome.TEAM_A);
    const durableRound = await prisma.round.findUniqueOrThrow({
      where: { id: round.id },
    });
    const durableTournament = await prisma.tournament.findUniqueOrThrow({
      where: { id: tournament.id },
    });
    expect(durableRound.status).toBe('COMPLETED');
    expect(durableTournament.status).toBe(TournamentStatus.COMPLETED);
    expect(
      await prisma.team.count({
        where: { tournamentId: tournament.id, finalRank: 1 },
      }),
    ).toBe(1);
  });

  it('preserves locked Swiss iteration generation and persisted odd-team BYE behavior', async () => {
    const { tournament } = await tournamentFixture('Swiss', 5);
    const round = await prisma.round.create({
      data: {
        name: 'Swiss',
        orderIndex: 1,
        format: RoundFormat.SWISS,
        bestOf: 1,
        status: 'ONGOING',
        tournamentId: tournament.id,
        settings: { numberOfRounds: 2, advancingTeamCount: 2 },
      },
    });
    const first = await Promise.allSettled([
      swiss.generateNextSwissRound(round.id),
      swiss.generateNextSwissRound(round.id),
    ]);
    expect(
      first.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(first.filter((result) => result.status === 'rejected')).toHaveLength(
      1,
    );
    const firstMatches = await prisma.match.findMany({
      where: { roundId: round.id, bracketRound: 1 },
    });
    expect(firstMatches).toHaveLength(3);
    expect(firstMatches.filter((match) => match.isBye)).toHaveLength(1);
    for (const match of firstMatches.filter((candidate) => !candidate.isBye)) {
      await matches.update(match.id, {
        scoreA: 1,
        scoreB: 0,
        status: MatchStatus.COMPLETED,
      });
    }
    const second = await swiss.generateNextSwissRound(round.id);
    expect(second.bracketRound).toBe(2);
    expect(
      await prisma.match.count({
        where: { roundId: round.id, bracketRound: 2 },
      }),
    ).toBe(3);
  });

  it('serializes a destructive downstream reset and clears every derived result', async () => {
    const { tournament, teams } = await tournamentFixture('DownstreamReset');
    const sourceRound = await prisma.round.create({
      data: {
        name: 'Qualification',
        orderIndex: 1,
        format: RoundFormat.ROUND_ROBIN,
        bestOf: 1,
        status: 'COMPLETED',
        tournamentId: tournament.id,
        settings: { advancingTeamCount: 2 },
      },
    });
    const finalRound = await prisma.round.create({
      data: {
        name: 'Final',
        orderIndex: 2,
        format: RoundFormat.PLAYOFF,
        bestOf: 1,
        status: 'COMPLETED',
        tournamentId: tournament.id,
        settings: { thirdPlaceMatch: false },
      },
    });
    await prisma.roundTeam.createMany({
      data: teams.slice(0, 2).map((team, index) => ({
        roundId: finalRound.id,
        teamId: team.id,
        seed: index + 1,
        advancedFromRoundId: sourceRound.id,
      })),
    });
    const finalMatch = await prisma.match.create({
      data: {
        roundId: finalRound.id,
        teamAId: teams[0].id,
        teamBId: teams[1].id,
        status: MatchStatus.COMPLETED,
        outcome: MatchOutcome.TEAM_A,
        winnerTeamId: teams[0].id,
        scoreA: 1,
        scoreB: 0,
        bestOf: 1,
      },
    });
    await prisma.matchScore.create({
      data: {
        matchId: finalMatch.id,
        setNumber: 1,
        teamAScore: 1,
        teamBScore: 0,
      },
    });
    await prisma.team.update({
      where: { id: teams[0].id },
      data: { finalRank: 1 },
    });
    await prisma.tournament.update({
      where: { id: tournament.id },
      data: { status: TournamentStatus.COMPLETED },
    });

    const preview = await brackets.previewDownstreamReset(sourceRound.id);
    expect(preview.impact).toEqual(
      expect.objectContaining({
        roundCount: 1,
        matchCount: 1,
        completedMatchCount: 1,
        participantAssignmentCount: 2,
        finalRankedTeamCount: 1,
      }),
    );
    const attempts = await Promise.allSettled([
      brackets.resetDownstream(sourceRound.id, preview.previewToken),
      brackets.resetDownstream(sourceRound.id, preview.previewToken),
    ]);
    expect(
      attempts.filter((attempt) => attempt.status === 'fulfilled'),
    ).toHaveLength(1);
    expect(
      attempts.filter((attempt) => attempt.status === 'rejected'),
    ).toHaveLength(1);
    expect(
      await prisma.match.count({ where: { roundId: finalRound.id } }),
    ).toBe(0);
    expect(
      await prisma.matchScore.count({ where: { matchId: finalMatch.id } }),
    ).toBe(0);
    expect(
      await prisma.roundTeam.count({ where: { roundId: finalRound.id } }),
    ).toBe(0);
    expect(
      await prisma.round.findUniqueOrThrow({ where: { id: finalRound.id } }),
    ).toEqual(expect.objectContaining({ status: 'UPCOMING' }));
    expect(
      await prisma.tournament.findUniqueOrThrow({
        where: { id: tournament.id },
      }),
    ).toEqual(expect.objectContaining({ status: TournamentStatus.ONGOING }));
    expect(
      await prisma.team.count({
        where: { tournamentId: tournament.id, finalRank: { not: null } },
      }),
    ).toBe(0);
  });
});
