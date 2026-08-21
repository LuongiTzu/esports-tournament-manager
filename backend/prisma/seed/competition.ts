import {
  MatchOutcome,
  MatchStatus,
  RoundFormat,
  RoundStatus,
} from '@prisma/client';
import { BracketOperationsService } from '../../src/brackets/bracket-operations.service';
import { SwissService } from '../../src/brackets/swiss.service';
import { MatchesService } from '../../src/matches/matches.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { SeedTournamentSpec } from './data';

interface CompetitionServices {
  prisma: PrismaService;
  brackets: BracketOperationsService;
  swiss: SwissService;
  matches: MatchesService;
}

interface RoundRecord {
  id: string;
  format: RoundFormat;
  orderIndex: number;
  settings: unknown;
}

export async function seedCompetition(
  services: CompetitionServices,
  tournament: SeedTournamentSpec,
  rounds: RoundRecord[],
): Promise<void> {
  if (tournament.competition === 'NONE') return;

  const firstRound = rounds[0];
  if (rounds.length === 2) {
    await completeQualifyingRound(services, tournament, firstRound);
    const finalRound = rounds[1];
    await services.brackets.generate(finalRound.id);
    await markRoundOngoing(services.prisma, finalRound.id);
    await scheduleUnscheduledMatches(
      services.prisma,
      tournament,
      finalRound.id,
    );
    await completeAvailableMatches(services, tournament, finalRound, {
      limit:
        tournament.competition === 'COMPLETE'
          ? Number.POSITIVE_INFINITY
          : (tournament.partialMatchLimit ?? 2),
      allowDraws: false,
    });
  } else if (firstRound.format === RoundFormat.SWISS) {
    await seedSwissRound(services, tournament, firstRound);
  } else {
    await services.brackets.generate(firstRound.id);
    await markRoundOngoing(services.prisma, firstRound.id);
    await scheduleUnscheduledMatches(
      services.prisma,
      tournament,
      firstRound.id,
    );
    await completeAvailableMatches(services, tournament, firstRound, {
      limit:
        tournament.competition === 'COMPLETE'
          ? Number.POSITIVE_INFINITY
          : (tournament.partialMatchLimit ?? 4),
      allowDraws: roundAllowsDraws(firstRound),
    });

    if (tournament.competition === 'COMPLETE') {
      await services.prisma.round.update({
        where: { id: firstRound.id },
        data: { status: RoundStatus.COMPLETED },
      });
    }
  }

  if (tournament.competition === 'PARTIAL') {
    await startOneAvailableMatch(services, rounds);
  }

  await services.prisma.tournament.update({
    where: { id: tournament.id },
    data: { status: tournament.status },
  });
}

async function startOneAvailableMatch(
  services: CompetitionServices,
  rounds: RoundRecord[],
): Promise<void> {
  const match = await services.prisma.match.findFirst({
    where: {
      roundId: { in: rounds.map((round) => round.id) },
      status: MatchStatus.PENDING,
      isActive: true,
      teamAId: { not: null },
      teamBId: { not: null },
      bestOf: { gte: 3 },
    },
    orderBy: [{ scheduledAt: 'asc' }, { id: 'asc' }],
    select: { id: true },
  });
  if (!match) return;
  await services.matches.update(match.id, {
    status: MatchStatus.ONGOING,
    scoreA: 1,
    scoreB: 0,
  });
}

async function completeQualifyingRound(
  services: CompetitionServices,
  tournament: SeedTournamentSpec,
  round: RoundRecord,
): Promise<void> {
  if (round.format === RoundFormat.SWISS) {
    await seedSwissIterations(services, tournament, round, true);
  } else {
    await services.brackets.generate(round.id);
    await markRoundOngoing(services.prisma, round.id);
    await scheduleUnscheduledMatches(services.prisma, tournament, round.id);
    await completeAvailableMatches(services, tournament, round, {
      limit: Number.POSITIVE_INFINITY,
      allowDraws: roundAllowsDraws(round),
    });
  }

  await services.brackets.advance(round.id);
  await services.prisma.round.update({
    where: { id: round.id },
    data: { status: RoundStatus.COMPLETED },
  });
}

async function seedSwissRound(
  services: CompetitionServices,
  tournament: SeedTournamentSpec,
  round: RoundRecord,
): Promise<void> {
  const completeStage = tournament.competition === 'COMPLETE';
  await seedSwissIterations(services, tournament, round, completeStage);
  if (completeStage) {
    await services.prisma.round.update({
      where: { id: round.id },
      data: { status: RoundStatus.COMPLETED },
    });
  }
}

async function seedSwissIterations(
  services: CompetitionServices,
  tournament: SeedTournamentSpec,
  round: RoundRecord,
  completeStage: boolean,
): Promise<void> {
  const settings = round.settings as {
    numberOfRounds: number | null;
  };
  if (!settings.numberOfRounds) {
    throw new Error(`Seeded Swiss round ${round.id} requires numberOfRounds`);
  }

  await markRoundOngoing(services.prisma, round.id);
  const completedRounds = completeStage
    ? settings.numberOfRounds
    : (tournament.swissCompletedRounds ?? 1);

  for (let iteration = 1; iteration <= settings.numberOfRounds; iteration++) {
    await services.swiss.generateNextSwissRound(round.id);
    await scheduleUnscheduledMatches(services.prisma, tournament, round.id);
    if (iteration > completedRounds) break;
    await completeAvailableMatches(services, tournament, round, {
      limit: Number.POSITIVE_INFINITY,
      allowDraws: false,
      bracketRound: iteration,
    });
  }
}

async function completeAvailableMatches(
  services: CompetitionServices,
  tournament: SeedTournamentSpec,
  round: RoundRecord,
  options: {
    limit: number;
    allowDraws: boolean;
    bracketRound?: number;
  },
): Promise<void> {
  let completed = 0;
  while (completed < options.limit) {
    const candidates = await services.prisma.match.findMany({
      where: {
        roundId: round.id,
        status: MatchStatus.PENDING,
        isActive: true,
        teamAId: { not: null },
        teamBId: { not: null },
        ...(options.bracketRound ? { bracketRound: options.bracketRound } : {}),
      },
      include: {
        teamA: { select: { seed: true } },
        teamB: { select: { seed: true } },
      },
    });
    if (!candidates.length) break;

    candidates.sort((left, right) =>
      matchPriority(left).localeCompare(matchPriority(right)),
    );
    const match = candidates[0];
    const useDraw = options.allowDraws && completed % 4 === 3;
    const winsRequired = Math.floor(match.bestOf / 2) + 1;
    const grandFinalResetRequired = Boolean(
      tournament.forceGrandFinalReset &&
      match.nextMatchId &&
      match.nextMatchId === match.loserNextMatchId,
    );
    const teamAWins = grandFinalResetRequired
      ? false
      : (match.teamA?.seed ?? 9999) <= (match.teamB?.seed ?? 9999);

    await services.matches.update(match.id, {
      status: MatchStatus.COMPLETED,
      scoreA: useDraw
        ? 1
        : teamAWins
          ? winsRequired
          : Math.max(0, winsRequired - 1),
      scoreB: useDraw
        ? 1
        : teamAWins
          ? Math.max(0, winsRequired - 1)
          : winsRequired,
    });
    completed++;
  }

  if (options.limit === Number.POSITIVE_INFINITY) {
    const incomplete = await services.prisma.match.count({
      where: {
        roundId: round.id,
        isActive: true,
        status: { not: MatchStatus.COMPLETED },
        ...(options.bracketRound ? { bracketRound: options.bracketRound } : {}),
      },
    });
    if (incomplete > 0) {
      throw new Error(
        `Unable to complete ${incomplete} active match(es) in seeded round ${round.id}`,
      );
    }
  }
}

async function scheduleUnscheduledMatches(
  prisma: PrismaService,
  tournament: SeedTournamentSpec,
  roundId: string,
): Promise<void> {
  const matches = await prisma.match.findMany({
    where: { roundId, scheduledAt: null },
    orderBy: [{ bracketRound: 'asc' }, { matchNumber: 'asc' }],
    select: { id: true, bracketRound: true, matchNumber: true },
  });
  const round = await prisma.round.findUniqueOrThrow({
    where: { id: roundId },
    select: { orderIndex: true },
  });
  const start = new Date(tournament.startDate).getTime();
  for (const match of matches) {
    await prisma.match.update({
      where: { id: match.id },
      data: {
        scheduledAt: new Date(
          start +
            (round.orderIndex - 1) * 7 * 24 * 60 * 60 * 1000 +
            ((match.bracketRound ?? 1) - 1) * 24 * 60 * 60 * 1000 +
            ((match.matchNumber ?? 1) - 1) * 90 * 60 * 1000,
        ),
        discordLink:
          tournament.mode === 'ONLINE'
            ? `https://discord.gg/dev-seed-${tournament.id.slice(-2)}`
            : null,
      },
    });
  }
}

function roundAllowsDraws(round: RoundRecord): boolean {
  return (
    (round.format === RoundFormat.ROUND_ROBIN ||
      round.format === RoundFormat.GROUP_STAGE) &&
    (round.settings as { allowDraws?: boolean })?.allowDraws === true
  );
}

function matchPriority(match: {
  bracketRound: number | null;
  bracketType: string | null;
  matchNumber: number | null;
  id: string;
}): string {
  const typeOrder =
    match.bracketType === 'WINNER'
      ? '0'
      : match.bracketType === 'LOSER'
        ? '1'
        : '2';
  return `${String(match.bracketRound ?? 0).padStart(3, '0')}-${typeOrder}-${String(match.matchNumber ?? 0).padStart(3, '0')}-${match.id}`;
}

async function markRoundOngoing(
  prisma: PrismaService,
  roundId: string,
): Promise<void> {
  await prisma.round.update({
    where: { id: roundId },
    data: { status: RoundStatus.ONGOING },
  });
}

export function isCompletedDraw(match: {
  status: MatchStatus;
  outcome: MatchOutcome | null;
}): boolean {
  return (
    match.status === MatchStatus.COMPLETED &&
    match.outcome === MatchOutcome.DRAW
  );
}
