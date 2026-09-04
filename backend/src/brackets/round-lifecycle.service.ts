import { Injectable, NotFoundException } from '@nestjs/common';
import {
  Prisma,
  RoundFormat,
  RoundStatus,
  TournamentStatus,
} from '@prisma/client';
import {
  evaluateRoundCompletion,
  RoundCompletionResult,
} from './domain/round-completion';
import { deriveRoundStatus } from './domain/round-lifecycle';
import { countPersistedRoundParticipants } from './domain/round-participant-count';
import { RoundSettingsService } from './round-settings.service';
import { RoundSettingsMap } from './types/round-settings';

type LifecycleTransaction = Pick<
  Prisma.TransactionClient,
  '$queryRaw' | 'round' | 'tournament'
>;

@Injectable()
export class RoundLifecycleService {
  constructor(
    private readonly settingsService: RoundSettingsService = new RoundSettingsService(),
  ) {}

  async synchronize(tx: LifecycleTransaction, roundId: string) {
    const reference = await tx.round.findUnique({
      where: { id: roundId },
      select: { id: true, tournamentId: true },
    });
    if (!reference) throw new NotFoundException('Round not found');

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
        tournamentId: true,
        format: true,
        settings: true,
        status: true,
        tournament: { select: { status: true } },
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
            scoreA: true,
            scoreB: true,
            playedAt: true,
            _count: { select: { scores: true } },
          },
        },
      },
    });
    if (!round || round.tournamentId !== reference.tournamentId) {
      throw new NotFoundException('Round not found');
    }

    const completion = evaluateSnapshot(round, this.settingsService);
    const status = deriveRoundStatus(
      completion,
      round.matches.map((match) => ({
        ...match,
        scoreCount: match._count.scores,
      })),
    );
    if (status !== round.status) {
      await tx.round.update({ where: { id: round.id }, data: { status } });
    }

    const tournamentStarted =
      status !== RoundStatus.UPCOMING &&
      round.tournament.status === TournamentStatus.REGISTRATION;
    if (tournamentStarted) {
      await tx.tournament.update({
        where: { id: round.tournamentId },
        data: {
          status: TournamentStatus.ONGOING,
          registrationOpen: false,
        },
      });
    }

    return {
      roundId: round.id,
      previousStatus: round.status,
      status,
      changed: status !== round.status,
      tournamentStarted,
      completion,
    };
  }
}

type LifecycleSnapshot = {
  format: RoundFormat;
  settings: Prisma.JsonValue | null;
  participants: Array<{ teamId: string }>;
  groups: Array<{
    id: string;
    teamAssignments: Array<{ teamId: string }>;
  }>;
  matches: Array<{
    status: 'PENDING' | 'ONGOING' | 'COMPLETED';
    isActive: boolean;
    isBye: boolean;
    bracketRound: number | null;
    bracketType: 'WINNER' | 'LOSER' | null;
    matchNumber: number | null;
    groupId: string | null;
    winnerTeamId: string | null;
    teamAId: string | null;
    teamBId: string | null;
  }>;
};

function evaluateSnapshot(
  round: LifecycleSnapshot,
  settingsService: RoundSettingsService,
): RoundCompletionResult {
  const participantCount = countPersistedRoundParticipants(round);
  const settings = settingsService.getEffectiveSettings(
    round.format,
    round.settings,
  );
  const groups = round.groups.map((group) => ({
    id: group.id,
    teamCount: group.teamAssignments.length,
  }));

  switch (round.format) {
    case RoundFormat.ROUND_ROBIN:
      return evaluateRoundCompletion({
        format: round.format,
        settings: settings as RoundSettingsMap[typeof round.format],
        participantCount,
        matches: round.matches,
      });
    case RoundFormat.GROUP_STAGE:
      return evaluateRoundCompletion({
        format: round.format,
        settings: settings as RoundSettingsMap[typeof round.format],
        participantCount,
        matches: round.matches,
        groups,
      });
    case RoundFormat.SWISS:
      return evaluateRoundCompletion({
        format: round.format,
        settings: settings as RoundSettingsMap[typeof round.format],
        participantCount,
        matches: round.matches,
      });
    case RoundFormat.PLAYOFF:
      return evaluateRoundCompletion({
        format: round.format,
        settings: settings as RoundSettingsMap[typeof round.format],
        participantCount,
        matches: round.matches,
      });
    case RoundFormat.DOUBLE_ELIM:
      return evaluateRoundCompletion({
        format: round.format,
        settings: settings as RoundSettingsMap[typeof round.format],
        participantCount,
        matches: round.matches,
      });
  }
}
