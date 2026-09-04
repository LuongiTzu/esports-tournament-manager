import { config } from 'dotenv';
import { resolve } from 'path';
import {
  MatchStatus,
  PrismaClient,
  RegistrationStatus,
  RoundFormat,
  RoundStatus,
  TournamentStatus,
} from '@prisma/client';

config({ path: resolve(process.cwd(), '.env') });

type Severity = 'ERROR' | 'WARNING';

interface Finding {
  severity: Severity;
  code: string;
  tournamentId: string;
  roundId?: string;
  details: string;
}

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const strict = process.argv.includes('--strict');
  const tournaments = await prisma.tournament.findMany({
    select: {
      id: true,
      status: true,
      registrationOpen: true,
      rounds: {
        orderBy: [{ orderIndex: 'asc' }, { id: 'asc' }],
        select: {
          id: true,
          orderIndex: true,
          format: true,
          status: true,
          matches: {
            select: {
              teamAId: true,
              teamBId: true,
              status: true,
              isActive: true,
              isBye: true,
              scoreA: true,
              scoreB: true,
              winnerTeamId: true,
              playedAt: true,
              _count: { select: { scores: true } },
            },
          },
          groups: {
            select: {
              teamAssignments: { select: { teamId: true } },
            },
          },
          participants: {
            select: {
              teamId: true,
              seed: true,
              advancedFromRoundId: true,
              team: {
                select: {
                  tournamentId: true,
                  status: true,
                },
              },
            },
          },
        },
      },
    },
  });

  const findings: Finding[] = [];
  let roundCount = 0;
  let structuredRoundCount = 0;

  for (const tournament of tournaments) {
    const rounds = tournament.rounds;
    roundCount += rounds.length;

    const duplicateOrderIndexes = duplicateValues(
      rounds.map((round) => round.orderIndex),
    );
    if (duplicateOrderIndexes.length) {
      findings.push({
        severity: 'ERROR',
        code: 'DUPLICATE_ROUND_ORDER',
        tournamentId: tournament.id,
        details: `Duplicate order indexes: ${duplicateOrderIndexes.join(', ')}.`,
      });
    }

    const firstRound = rounds[0];
    if (firstRound && hasStructure(firstRound)) {
      structuredRoundCount++;
      if (tournament.registrationOpen) {
        findings.push({
          severity: 'WARNING',
          code: 'REGISTRATION_OPEN_AFTER_FIRST_GENERATION',
          tournamentId: tournament.id,
          roundId: firstRound.id,
          details:
            'The first Round has a structure while registration is open.',
        });
      }
    }

    rounds.forEach((round, index) => {
      const previousRound = rounds[index - 1];
      const laterRounds = rounds.slice(index + 1);
      const structured = hasStructure(round);
      if (structured && index > 0) structuredRoundCount++;

      if (
        (round.format === RoundFormat.PLAYOFF ||
          round.format === RoundFormat.DOUBLE_ELIM) &&
        laterRounds.length > 0
      ) {
        findings.push({
          severity: 'ERROR',
          code: 'ELIMINATION_NOT_TERMINAL',
          tournamentId: tournament.id,
          roundId: round.id,
          details: `${round.format} is followed by ${laterRounds.length} Round(s).`,
        });
      }

      if (index > 0 && structured && round.participants.length === 0) {
        findings.push({
          severity: 'ERROR',
          code: 'LATER_ROUND_STRUCTURE_WITHOUT_PARTICIPANTS',
          tournamentId: tournament.id,
          roundId: round.id,
          details:
            'A later Round has groups or matches but no RoundTeam snapshot.',
        });
      }

      if (index === 0 && round.participants.length > 0) {
        findings.push({
          severity: 'WARNING',
          code: 'FIRST_ROUND_HAS_ADVANCED_PARTICIPANTS',
          tournamentId: tournament.id,
          roundId: round.id,
          details:
            'The first ordered Round unexpectedly has RoundTeam participants.',
        });
      }

      if (index > 0 && round.participants.length > 0) {
        const missingSeedTeamIds = round.participants
          .filter((participant) => participant.seed === null)
          .map((participant) => participant.teamId);
        if (missingSeedTeamIds.length > 0) {
          findings.push({
            severity: 'WARNING',
            code: 'LEGACY_ROUND_PARTICIPANT_SEED_MISSING',
            tournamentId: tournament.id,
            roundId: round.id,
            details: `Teams without a per-Round seed: ${formatIds(missingSeedTeamIds)}.`,
          });
        }
        const seeds = round.participants
          .map((participant) => participant.seed)
          .filter((seed): seed is number => seed !== null);
        const duplicateSeeds = duplicateValues(seeds);
        if (duplicateSeeds.length > 0) {
          findings.push({
            severity: 'ERROR',
            code: 'DUPLICATE_ROUND_PARTICIPANT_SEED',
            tournamentId: tournament.id,
            roundId: round.id,
            details: `Duplicate per-Round seeds: ${duplicateSeeds.join(', ')}.`,
          });
        }
        const invalidSeeds = seeds.filter(
          (seed) => seed < 1 || seed > round.participants.length,
        );
        if (invalidSeeds.length > 0) {
          findings.push({
            severity: 'ERROR',
            code: 'INVALID_ROUND_PARTICIPANT_SEED',
            tournamentId: tournament.id,
            roundId: round.id,
            details: `Out-of-range per-Round seeds: ${invalidSeeds.join(', ')}.`,
          });
        }
      }

      for (const participant of round.participants) {
        if (
          previousRound &&
          participant.advancedFromRoundId !== previousRound.id
        ) {
          findings.push({
            severity: 'ERROR',
            code: 'PARTICIPANT_SKIPS_PREVIOUS_ROUND',
            tournamentId: tournament.id,
            roundId: round.id,
            details: `Team ${participant.teamId} advanced from a non-adjacent Round.`,
          });
        }
        if (
          participant.team.tournamentId !== tournament.id ||
          participant.team.status !== RegistrationStatus.APPROVED
        ) {
          findings.push({
            severity: 'ERROR',
            code: 'INELIGIBLE_ROUND_PARTICIPANT',
            tournamentId: tournament.id,
            roundId: round.id,
            details: `Team ${participant.teamId} is not an approved team of this Tournament.`,
          });
        }
      }

      if (structured && round.participants.length > 0) {
        const participantIds = new Set(
          round.participants.map((participant) => participant.teamId),
        );
        const structureIds = structureTeamIds(round);
        const unexpected = difference(structureIds, participantIds);
        const missing = difference(participantIds, structureIds);
        if (unexpected.length || missing.length) {
          findings.push({
            severity: 'ERROR',
            code: 'PARTICIPANT_STRUCTURE_MISMATCH',
            tournamentId: tournament.id,
            roundId: round.id,
            details: `Unexpected teams: ${formatIds(unexpected)}; missing teams: ${formatIds(missing)}.`,
          });
        }
      }

      const realProgress = round.matches.some(
        (match) =>
          !match.isBye &&
          (match.status !== MatchStatus.PENDING ||
            match.scoreA !== 0 ||
            match.scoreB !== 0 ||
            match.winnerTeamId !== null ||
            match.playedAt !== null ||
            match._count.scores > 0),
      );
      if (round.status === RoundStatus.UPCOMING && realProgress) {
        findings.push({
          severity: 'WARNING',
          code: 'UPCOMING_ROUND_HAS_PROGRESS',
          tournamentId: tournament.id,
          roundId: round.id,
          details:
            'The Round is UPCOMING but at least one real match has progress.',
        });
      }

      const incompleteActiveMatch = round.matches.some(
        (match) => match.isActive && match.status !== MatchStatus.COMPLETED,
      );
      if (
        round.status === RoundStatus.COMPLETED &&
        (round.matches.length === 0 || incompleteActiveMatch)
      ) {
        findings.push({
          severity: 'ERROR',
          code: 'COMPLETED_ROUND_HAS_INCOMPLETE_STRUCTURE',
          tournamentId: tournament.id,
          roundId: round.id,
          details:
            round.matches.length === 0
              ? 'The Round is COMPLETED but has no matches.'
              : 'The Round is COMPLETED but has an incomplete active match.',
        });
      }
    });

    if (tournament.status === TournamentStatus.COMPLETED) {
      const lastRound = rounds[rounds.length - 1];
      if (!lastRound || lastRound.status !== RoundStatus.COMPLETED) {
        findings.push({
          severity: 'ERROR',
          code: 'COMPLETED_TOURNAMENT_WITHOUT_COMPLETED_FINAL_ROUND',
          tournamentId: tournament.id,
          roundId: lastRound?.id,
          details:
            'The Tournament is COMPLETED but its final Round is not COMPLETED.',
        });
      }
    }
  }

  const errorCount = findings.filter(
    (finding) => finding.severity === 'ERROR',
  ).length;
  const warningCount = findings.length - errorCount;

  console.log('Competition progression audit (read-only)');
  console.log(`Tournaments inspected: ${tournaments.length}`);
  console.log(`Rounds inspected: ${roundCount}`);
  console.log(`Structured Rounds inspected: ${structuredRoundCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Warnings: ${warningCount}`);

  for (const finding of findings) {
    const scope = [
      `tournament=${finding.tournamentId}`,
      finding.roundId ? `round=${finding.roundId}` : null,
    ]
      .filter((value): value is string => value !== null)
      .join(' ');
    console.log(
      `[${finding.severity}] ${finding.code} ${scope}: ${finding.details}`,
    );
  }

  if (strict && findings.length > 0) process.exitCode = 1;
}

function hasStructure(round: {
  matches: readonly unknown[];
  groups: readonly unknown[];
}): boolean {
  return round.matches.length > 0 || round.groups.length > 0;
}

function structureTeamIds(round: {
  matches: ReadonlyArray<{ teamAId: string | null; teamBId: string | null }>;
  groups: ReadonlyArray<{
    teamAssignments: ReadonlyArray<{ teamId: string }>;
  }>;
}): Set<string> {
  return new Set([
    ...round.matches.flatMap((match) =>
      [match.teamAId, match.teamBId].filter(
        (teamId): teamId is string => teamId !== null,
      ),
    ),
    ...round.groups.flatMap((group) =>
      group.teamAssignments.map((assignment) => assignment.teamId),
    ),
  ]);
}

function difference(left: Set<string>, right: Set<string>): string[] {
  return [...left].filter((value) => !right.has(value)).sort();
}

function duplicateValues(values: number[]): number[] {
  const counts = new Map<number, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([value]) => value)
    .sort((left, right) => left - right);
}

function formatIds(ids: string[]): string {
  return ids.length > 0 ? ids.join(', ') : 'none';
}

main()
  .catch((error: unknown) => {
    console.error('Competition progression audit failed.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
