import { ConflictException, Injectable } from '@nestjs/common';
import { Prisma, RoundFormat, TournamentStatus } from '@prisma/client';
import {
  ApplicationErrorCode,
  type ApplicationErrorCode as ApplicationErrorCodeValue,
} from '../common/errors/application-error-code';
import {
  evaluateRoundCompletion,
  RoundCompletionGroup,
  RoundCompletionMatch,
  RoundCompletionResult,
} from './domain/round-completion';
import { RoundSettingsService } from './round-settings.service';
import { RoundSettingsMap } from './types/round-settings';
import { countPersistedRoundParticipants } from './domain/round-participant-count';

export interface RoundGenerationTarget {
  id: string;
  tournamentId: string;
  orderIndex: number;
}

type GenerationTransaction = Pick<
  Prisma.TransactionClient,
  '$queryRaw' | 'round' | 'tournament'
>;

interface PersistedRoundSnapshot {
  id: string;
  orderIndex: number;
  format: RoundFormat;
  settings: Prisma.JsonValue | null;
  participants: Array<{ teamId: string }>;
  groups: Array<{
    id: string;
    teamAssignments: Array<{ teamId: string }>;
  }>;
  matches: Array<
    RoundCompletionMatch & {
      teamAId: string | null;
      teamBId: string | null;
    }
  >;
}

/**
 * Backend policy boundary for creating a Round's persisted competition
 * structure. It deliberately runs inside the caller's write transaction so
 * the checked lifecycle state cannot drift before matches are inserted.
 */
@Injectable()
export class RoundGenerationReadinessService {
  constructor(
    private readonly settingsService: RoundSettingsService = new RoundSettingsService(),
  ) {}

  async assertCanGenerate(
    tx: GenerationTransaction,
    target: RoundGenerationTarget,
  ): Promise<void> {
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "tournaments" WHERE "id" = ${target.tournamentId} FOR UPDATE`,
    );
    const tournament = await tx.tournament.findUnique({
      where: { id: target.tournamentId },
      select: { status: true, registrationOpen: true },
    });
    if (!tournament) {
      throw conflict(
        ApplicationErrorCode.TOURNAMENT_NOT_FOUND,
        'Tournament for this Round no longer exists',
      );
    }
    if (
      tournament.status === TournamentStatus.DRAFT ||
      tournament.status === TournamentStatus.COMPLETED ||
      tournament.status === TournamentStatus.CANCELLED
    ) {
      throw conflict(
        ApplicationErrorCode.TOURNAMENT_NOT_MUTABLE,
        'Publish the Tournament before generation; completed or cancelled Tournaments are immutable',
        { tournamentStatus: tournament.status },
      );
    }

    if (target.orderIndex === 1) {
      if (tournament.registrationOpen) {
        throw conflict(
          ApplicationErrorCode.REGISTRATION_MUST_BE_CLOSED,
          'Close registration before generating the first Round',
        );
      }
      return;
    }

    const previousReference = await tx.round.findFirst({
      where: {
        tournamentId: target.tournamentId,
        orderIndex: { lt: target.orderIndex },
      },
      orderBy: { orderIndex: 'desc' },
      select: {
        id: true,
        orderIndex: true,
        format: true,
      },
    });
    if (
      !previousReference ||
      previousReference.orderIndex !== target.orderIndex - 1
    ) {
      throw conflict(
        ApplicationErrorCode.ROUND_SEQUENCE_INVALID,
        'The immediately preceding Round does not exist',
        { expectedPreviousOrderIndex: target.orderIndex - 1 },
      );
    }

    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "rounds" WHERE "id" = ${previousReference.id} FOR UPDATE`,
    );
    await tx.$queryRaw(
      Prisma.sql`SELECT "id" FROM "matches" WHERE "round_id" = ${previousReference.id} ORDER BY "id" FOR UPDATE`,
    );
    const previous = await tx.round.findUnique({
      where: { id: previousReference.id },
      select: {
        id: true,
        orderIndex: true,
        format: true,
        settings: true,
        participants: { select: { teamId: true } },
        groups: {
          select: {
            id: true,
            teamAssignments: { select: { teamId: true } },
          },
        },
        matches: {
          select: {
            status: true,
            isActive: true,
            isBye: true,
            bracketRound: true,
            bracketType: true,
            matchNumber: true,
            groupId: true,
            winnerTeamId: true,
            teamAId: true,
            teamBId: true,
          },
        },
      },
    });
    if (!previous || previous.orderIndex !== target.orderIndex - 1) {
      throw conflict(
        ApplicationErrorCode.ROUND_SEQUENCE_INVALID,
        'The immediately preceding Round changed during generation',
        { expectedPreviousOrderIndex: target.orderIndex - 1 },
      );
    }

    if (
      previous.format === RoundFormat.PLAYOFF ||
      previous.format === RoundFormat.DOUBLE_ELIM
    ) {
      throw conflict(
        ApplicationErrorCode.ELIMINATION_MUST_BE_TERMINAL,
        'An elimination Round must be the final Round of a tournament',
        { previousRoundId: previous.id, previousFormat: previous.format },
      );
    }

    const completion = this.evaluate(previous);
    if (!completion.completed) {
      throw conflict(
        ApplicationErrorCode.PREVIOUS_ROUND_NOT_COMPLETE,
        'The previous Round must be complete before generating this Round',
        {
          previousRoundId: previous.id,
          previousRoundOrderIndex: previous.orderIndex,
          completion,
        },
      );
    }
  }

  private evaluate(round: PersistedRoundSnapshot): RoundCompletionResult {
    const participantCount = countPersistedRoundParticipants(round);
    const matches: RoundCompletionMatch[] = round.matches;
    const groups: RoundCompletionGroup[] = round.groups.map((group) => ({
      id: group.id,
      teamCount: group.teamAssignments.length,
    }));
    const settings = this.settingsService.getEffectiveSettings(
      round.format,
      round.settings,
    );

    switch (round.format) {
      case RoundFormat.ROUND_ROBIN:
        return evaluateRoundCompletion({
          format: round.format,
          settings: settings as RoundSettingsMap[typeof round.format],
          participantCount,
          matches,
        });
      case RoundFormat.GROUP_STAGE:
        return evaluateRoundCompletion({
          format: round.format,
          settings: settings as RoundSettingsMap[typeof round.format],
          participantCount,
          matches,
          groups,
        });
      case RoundFormat.SWISS:
        return evaluateRoundCompletion({
          format: round.format,
          settings: settings as RoundSettingsMap[typeof round.format],
          participantCount,
          matches,
        });
      case RoundFormat.PLAYOFF:
        return evaluateRoundCompletion({
          format: round.format,
          settings: settings as RoundSettingsMap[typeof round.format],
          participantCount,
          matches,
        });
      case RoundFormat.DOUBLE_ELIM:
        return evaluateRoundCompletion({
          format: round.format,
          settings: settings as RoundSettingsMap[typeof round.format],
          participantCount,
          matches,
        });
    }
  }
}

function conflict(
  code: ApplicationErrorCodeValue,
  message: string,
  details?: Record<string, unknown>,
): ConflictException {
  return new ConflictException({ code, message, ...(details ?? {}) });
}
