import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CompetitionAuditAction,
  MatchOutcome,
  MatchStatus,
  Prisma,
  RoundFormat,
  RoundStatus,
  TournamentStatus,
} from '@prisma/client';
import { ApplicationErrorCode } from '../common/errors/application-error-code';
import { PrismaService } from '../prisma/prisma.service';
import {
  resolveSwissProgress,
  SwissGenerationBlockedReason,
} from './domain/swiss-progress';
import { SwissGenerator } from './generators/swiss.generator';
import { RoundSettingsService } from './round-settings.service';
import {
  resolveSwissNumberOfRounds,
  SwissSettings,
} from './types/round-settings';
import { SwissMatchSnapshot } from './types/swiss';
import { SwissStandingsQueryService } from './swiss-standings-query.service';
import type { StandingsClient } from './standings.service';
import { RoundParticipantResolver } from './round-participant-resolver.service';
import {
  COMPETITION_AUDIT_WRITER,
  CompetitionAuditWriter,
  NOOP_COMPETITION_AUDIT_WRITER,
} from '../common/ports/competition-audit-writer';

@Injectable()
export class SwissService {
  private readonly logger = new Logger(SwissService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: RoundSettingsService,
    private readonly generator: SwissGenerator,
    private readonly standingsQuery: SwissStandingsQueryService = new SwissStandingsQueryService(
      prisma,
      settingsService,
      generator,
    ),
    private readonly participants: RoundParticipantResolver = new RoundParticipantResolver(),
    @Inject(COMPETITION_AUDIT_WRITER)
    private readonly audit: CompetitionAuditWriter = NOOP_COMPETITION_AUDIT_WRITER,
  ) {}

  async generateNextSwissRound(roundId: string, actorId?: string) {
    return this.prisma.$transaction(async (tx) => {
      const reference = await tx.round.findUnique({
        where: { id: roundId },
        select: { id: true, tournamentId: true },
      });
      if (!reference) throw new NotFoundException('Round not found');

      // Keep the same lock order as match-result writes to avoid deadlocks and
      // serialize two requests that observe the same Swiss iteration.
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "tournaments" WHERE "id" = ${reference.tournamentId} FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "rounds" WHERE "id" = ${roundId} FOR UPDATE`,
      );
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "matches" WHERE "round_id" = ${roundId} ORDER BY "id" FOR UPDATE`,
      );
      const round = await tx.round.findUnique({
        where: { id: roundId },
        select: {
          id: true,
          format: true,
          settings: true,
          bestOf: true,
          tournamentId: true,
          orderIndex: true,
          status: true,
          tournament: { select: { status: true } },
        },
      });
      if (!round) throw new NotFoundException('Round not found');
      if (round.format !== RoundFormat.SWISS) {
        throw new BadRequestException('Round format must be SWISS');
      }
      assertSwissMutationAllowed(round.status, round.tournament.status);

      const [teams, matches] = await Promise.all([
        this.participants
          .resolveForGeneration(tx, round)
          .then(({ teams }) => teams),
        tx.match.findMany({
          where: { roundId },
          select: {
            teamAId: true,
            teamBId: true,
            scoreA: true,
            scoreB: true,
            bracketRound: true,
            isBye: true,
            status: true,
            isActive: true,
            bracketType: true,
            matchNumber: true,
            groupId: true,
            winnerTeamId: true,
          },
          orderBy: [{ bracketRound: 'asc' }, { matchNumber: 'asc' }],
        }),
      ]);
      if (teams.length < 2) {
        throw new BadRequestException(
          'SWISS requires at least 2 approved teams',
        );
      }
      const rawSettings = asRecord(round.settings);
      const settings = (await this.settingsService.normalizeForFormat(
        RoundFormat.SWISS,
        rawSettings,
      )) as SwissSettings;
      const numberOfRounds = resolveSwissNumberOfRounds(
        teams.length,
        settings.numberOfRounds,
      );
      const progress = resolveSwissProgress({
        participantCount: teams.length,
        settings,
        matches,
        roundStatus: round.status,
        tournamentStatus: round.tournament.status,
      });
      if (matches.length > 0 && !progress.canGenerateNext) {
        throw swissGenerationError(progress.blockedReason);
      }

      const currentRound = progress.currentIteration;
      const nextRound = currentRound + 1;

      const snapshots = toSnapshots(matches);
      const result = this.generator.generateNext({
        teams,
        matches: snapshots,
        settings,
        bestOf: round.bestOf,
        bracketRound: nextRound,
      });
      result.warnings.forEach((warning) => this.logger.warn(warning));
      const persistedMatches = await tx.match.createManyAndReturn({
        data: result.matches.map((draft) => ({
          roundId,
          teamAId: draft.teamA.teamId,
          teamBId: draft.teamB.teamId,
          bracketRound: draft.bracketRound,
          matchNumber: draft.matchNumber,
          isBye: draft.isBye,
          bestOf: draft.bestOf,
          status: draft.isBye ? MatchStatus.COMPLETED : MatchStatus.PENDING,
          scoreA: draft.isBye ? 1 : 0,
          scoreB: 0,
          winnerTeamId: draft.isBye ? draft.teamA.teamId : null,
          outcome: draft.isBye ? MatchOutcome.TEAM_A : null,
        })),
        select: {
          id: true,
          bracketRound: true,
          matchNumber: true,
          teamAId: true,
          teamBId: true,
          isBye: true,
        },
      });
      const bye = persistedMatches.find((match) => match.isBye) ?? null;
      await this.audit.record(tx, {
        tournamentId: round.tournamentId,
        actorId,
        action: CompetitionAuditAction.SWISS_ITERATION_GENERATED,
        roundId,
        details: {
          bracketRound: nextRound,
          numberOfRounds,
          matchCount: persistedMatches.length,
          matchIds: persistedMatches.map((match) => match.id),
          byeTeamId: bye?.teamAId ?? null,
        },
      });
      return {
        roundId,
        bracketRound: nextRound,
        numberOfRounds,
        matchCount: persistedMatches.length,
        matchIds: persistedMatches.map((match) => match.id),
        matches: persistedMatches,
        bye: bye ? { matchId: bye.id, teamId: bye.teamAId } : null,
        warnings: result.warnings,
      };
    });
  }

  async calculateSwissStandings(roundId: string, client?: StandingsClient) {
    return client
      ? this.standingsQuery.calculateWithClient(client, roundId)
      : this.standingsQuery.calculate(roundId);
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}

function assertSwissMutationAllowed(
  roundStatus: RoundStatus,
  tournamentStatus: TournamentStatus,
): void {
  if (
    tournamentStatus === TournamentStatus.DRAFT ||
    tournamentStatus === TournamentStatus.COMPLETED ||
    tournamentStatus === TournamentStatus.CANCELLED
  ) {
    throw new ConflictException({
      code: ApplicationErrorCode.TOURNAMENT_NOT_MUTABLE,
      message: 'The Tournament does not allow Swiss generation.',
    });
  }
  if (roundStatus === RoundStatus.COMPLETED) {
    throw new ConflictException({
      code: ApplicationErrorCode.ROUND_NOT_MUTABLE,
      message: 'The Swiss round is already completed.',
    });
  }
}

function swissGenerationError(
  reason: SwissGenerationBlockedReason | null,
): ConflictException {
  switch (reason) {
    case 'TOURNAMENT_NOT_MUTABLE':
      return new ConflictException({
        code: ApplicationErrorCode.TOURNAMENT_NOT_MUTABLE,
        message: 'The Tournament does not allow Swiss generation.',
      });
    case 'ROUND_NOT_MUTABLE':
      return new ConflictException({
        code: ApplicationErrorCode.ROUND_NOT_MUTABLE,
        message: 'The Swiss round does not allow further generation.',
      });
    case 'CURRENT_ITERATION_INCOMPLETE':
      return new ConflictException({
        code: ApplicationErrorCode.SWISS_ITERATION_NOT_COMPLETE,
        message: 'The current Swiss iteration is not complete.',
      });
    case 'ALL_ITERATIONS_COMPLETE':
      return new ConflictException({
        code: ApplicationErrorCode.SWISS_ALL_ITERATIONS_COMPLETE,
        message: 'All resolved Swiss iterations are complete.',
      });
    case 'NOT_GENERATED':
    case 'STRUCTURE_INVALID':
    case null:
      return new ConflictException({
        code: ApplicationErrorCode.SWISS_STRUCTURE_INVALID,
        message: 'The persisted Swiss structure is invalid.',
      });
  }
}

function toSnapshots(
  matches: Array<{
    teamAId: string | null;
    teamBId: string | null;
    scoreA: number;
    scoreB: number;
    bracketRound: number | null;
    isBye: boolean;
    status: MatchStatus;
  }>,
): SwissMatchSnapshot[] {
  return matches
    .filter(
      (
        match,
      ): match is typeof match & { teamAId: string; bracketRound: number } =>
        match.teamAId !== null && match.bracketRound !== null,
    )
    .map((match) => ({
      teamAId: match.teamAId,
      teamBId: match.teamBId,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      bracketRound: match.bracketRound,
      isBye: match.isBye,
      completed: match.status === MatchStatus.COMPLETED,
    }));
}
