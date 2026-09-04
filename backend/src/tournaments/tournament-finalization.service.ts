import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  CompetitionAuditAction,
  Prisma,
  RoundFormat,
  RoundStatus,
  TournamentStatus,
} from '@prisma/client';
import { evaluateRoundCompletion } from '../brackets/domain/round-completion';
import { analyzeQualificationBoundary } from '../brackets/domain/qualification-boundary';
import { RoundParticipantResolver } from '../brackets/round-participant-resolver.service';
import { RoundSettingsService } from '../brackets/round-settings.service';
import { StandingsService } from '../brackets/standings.service';
import {
  RoundRobinSettings,
  SwissSettings,
} from '../brackets/types/round-settings';
import { ApplicationErrorCode } from '../common/errors/application-error-code';
import {
  NOTIFICATION_PUBLISHER,
  NOOP_NOTIFICATION_PUBLISHER,
  NotificationPublisher,
} from '../common/ports/notification-publisher';
import {
  NOOP_TOURNAMENT_EVENT_PUBLISHER,
  TOURNAMENT_EVENT_PUBLISHER,
  TournamentEventPublisher,
} from '../common/ports/tournament-event-publisher';
import { PrismaService } from '../prisma/prisma.service';
import { resolveTournamentFinalizationMode } from './domain/tournament-finalization.policy';
import {
  COMPETITION_AUDIT_WRITER,
  CompetitionAuditWriter,
  NOOP_COMPETITION_AUDIT_WRITER,
} from '../common/ports/competition-audit-writer';

const FINALIZATION_TEAM_SELECT = {
  id: true,
  name: true,
  shortName: true,
  logoUrl: true,
  seed: true,
  finalRank: true,
} as const;

@Injectable()
export class TournamentFinalizationService {
  private readonly logger = new Logger(TournamentFinalizationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: RoundSettingsService,
    private readonly participants: RoundParticipantResolver,
    private readonly standings: StandingsService,
    @Inject(TOURNAMENT_EVENT_PUBLISHER)
    private readonly events: TournamentEventPublisher = NOOP_TOURNAMENT_EVENT_PUBLISHER,
    @Inject(NOTIFICATION_PUBLISHER)
    private readonly notifications: NotificationPublisher = NOOP_NOTIFICATION_PUBLISHER,
    @Inject(COMPETITION_AUDIT_WRITER)
    private readonly audit: CompetitionAuditWriter = NOOP_COMPETITION_AUDIT_WRITER,
  ) {}

  async confirmFinalStandings(
    tournamentId: string,
    selectedChampionTeamId?: string,
    actorId?: string,
  ) {
    const result = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "tournaments" WHERE "id" = ${tournamentId} FOR UPDATE`,
        );
        const tournament = await tx.tournament.findUnique({
          where: { id: tournamentId },
          select: { id: true, status: true },
        });
        if (!tournament) {
          throw new NotFoundException({
            code: ApplicationErrorCode.TOURNAMENT_NOT_FOUND,
            message: 'Tournament not found',
          });
        }
        if (tournament.status !== TournamentStatus.ONGOING) {
          throw new ConflictException({
            code: ApplicationErrorCode.TOURNAMENT_FINALIZATION_NOT_READY,
            message: 'Only an ongoing Tournament can be finalized',
          });
        }

        const finalRound = await tx.round.findFirst({
          where: { tournamentId },
          orderBy: [{ orderIndex: 'desc' }, { id: 'desc' }],
          select: {
            id: true,
            name: true,
            tournamentId: true,
            orderIndex: true,
            format: true,
            status: true,
            settings: true,
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
              },
            },
          },
        });
        if (!finalRound) {
          throw new ConflictException({
            code: ApplicationErrorCode.TOURNAMENT_FINALIZATION_NOT_READY,
            message: 'The Tournament has no final Round',
          });
        }

        const mode = resolveTournamentFinalizationMode(finalRound.format);
        if (mode !== 'MANUAL_STANDINGS') {
          throw new ConflictException({
            code: ApplicationErrorCode.TOURNAMENT_FINALIZATION_UNSUPPORTED_FORMAT,
            message:
              mode === 'AUTOMATIC_ELIMINATION'
                ? 'Elimination Tournaments are completed automatically from the final match'
                : 'A terminal Group Stage cannot infer one overall champion',
            details: { format: finalRound.format, mode },
          });
        }

        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "rounds" WHERE "id" = ${finalRound.id} FOR UPDATE`,
        );
        await tx.$queryRaw(
          Prisma.sql`SELECT "id" FROM "matches" WHERE "round_id" = ${finalRound.id} FOR UPDATE`,
        );

        const resolved = await this.participants.resolveForGeneration(
          tx,
          finalRound,
        );
        const completion =
          finalRound.format === RoundFormat.ROUND_ROBIN
            ? evaluateRoundCompletion({
                format: RoundFormat.ROUND_ROBIN,
                settings: this.settings.getEffectiveSettings(
                  RoundFormat.ROUND_ROBIN,
                  finalRound.settings,
                ) as RoundRobinSettings,
                participantCount: resolved.teams.length,
                matches: finalRound.matches,
              })
            : evaluateRoundCompletion({
                format: RoundFormat.SWISS,
                settings: this.settings.getEffectiveSettings(
                  RoundFormat.SWISS,
                  finalRound.settings,
                ) as SwissSettings,
                participantCount: resolved.teams.length,
                matches: finalRound.matches,
              });
        if (!completion.completed) {
          throw new ConflictException({
            code: ApplicationErrorCode.TOURNAMENT_FINALIZATION_NOT_READY,
            message: 'The final Round is not structurally complete',
            details: completion,
          });
        }

        const calculated = await this.standings.forTournament(
          tournamentId,
          [finalRound],
          tx,
        );
        const finalStandings = calculated.rounds[0]?.standings ?? [];
        const orderedTeamIds = extractOrderedTeamIds(
          finalRound.format,
          finalStandings,
        );
        assertSameParticipants(
          resolved.teams.map((team) => team.id),
          orderedTeamIds,
        );
        const resolvedOrder = resolveChampion(
          finalRound.format,
          finalStandings,
          orderedTeamIds,
          selectedChampionTeamId,
        );

        await tx.team.updateMany({
          where: { tournamentId },
          data: { finalRank: null },
        });
        for (const [index, teamId] of resolvedOrder.entries()) {
          await tx.team.update({
            where: { id: teamId },
            data: { finalRank: index + 1 },
          });
        }
        await tx.round.update({
          where: { id: finalRound.id },
          data: { status: RoundStatus.COMPLETED },
        });
        await tx.tournament.update({
          where: { id: tournamentId },
          data: {
            status: TournamentStatus.COMPLETED,
            registrationOpen: false,
          },
        });
        const rankedTeams = await tx.team.findMany({
          where: { id: { in: resolvedOrder } },
          orderBy: { finalRank: 'asc' },
          select: FINALIZATION_TEAM_SELECT,
        });

        await this.audit.record(tx, {
          tournamentId,
          actorId,
          action: CompetitionAuditAction.FINAL_STANDINGS_CONFIRMED,
          roundId: finalRound.id,
          details: {
            championTeamId: rankedTeams[0].id,
            rankedTeamIds: rankedTeams.map((team) => team.id),
            selectedChampionTeamId: selectedChampionTeamId ?? null,
          },
        });

        return {
          tournamentId,
          round: {
            id: finalRound.id,
            name: finalRound.name,
            format: finalRound.format,
            status: RoundStatus.COMPLETED,
          },
          champion: rankedTeams[0],
          finalStandings: rankedTeams,
          status: TournamentStatus.COMPLETED,
        };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    this.events.publish({
      tournamentId,
      event: 'standingsUpdated',
      payload: {
        roundId: result.round.id,
        championTeamId: result.champion.id,
        completed: true,
      },
    });
    try {
      await this.notifications.createForTournamentEvent({
        tournamentId,
        type: 'TOURNAMENT_STATUS',
        content: 'Tournament completed',
        data: {
          kind: 'TOURNAMENT_STATUS',
          previousStatus: TournamentStatus.ONGOING,
          status: TournamentStatus.COMPLETED,
          championTeamId: result.champion.id,
        },
        sourceKey: `tournament:${tournamentId}:status:${TournamentStatus.ONGOING}:${TournamentStatus.COMPLETED}`,
      });
    } catch (error) {
      this.logger.error(
        `Tournament finalization committed but notification persistence failed for ${tournamentId}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
    return result;
  }
}

function extractOrderedTeamIds(
  format: RoundFormat,
  standings: unknown[],
): string[] {
  const key = format === RoundFormat.SWISS ? 'teamId' : 'id';
  return standings.flatMap((standing) => {
    if (!standing || typeof standing !== 'object') return [];
    const teamId = (standing as Record<string, unknown>)[key];
    return typeof teamId === 'string' ? [teamId] : [];
  });
}

function assertSameParticipants(
  participantIds: string[],
  standingTeamIds: string[],
): void {
  const participants = new Set(participantIds);
  const standings = new Set(standingTeamIds);
  const valid =
    participantIds.length >= 2 &&
    participantIds.length === participants.size &&
    standingTeamIds.length === standings.size &&
    participantIds.length === standingTeamIds.length &&
    participantIds.every((teamId) => standings.has(teamId));
  if (!valid) {
    throw new ConflictException({
      code: ApplicationErrorCode.TOURNAMENT_FINALIZATION_STANDINGS_INVALID,
      message:
        'Final standings do not exactly match the final Round participants',
      details: {
        participantCount: participantIds.length,
        standingTeamCount: standingTeamIds.length,
      },
    });
  }
}

function resolveChampion(
  format: RoundFormat,
  standings: unknown[],
  orderedTeamIds: string[],
  selectedChampionTeamId?: string,
): string[] {
  const candidates = standings.map((standing) =>
    championshipCandidate(format, standing),
  );
  const analysis = analyzeQualificationBoundary(candidates, 1);
  if (!analysis.tie) {
    if (
      selectedChampionTeamId &&
      selectedChampionTeamId !== analysis.automaticTeamIds[0]
    ) {
      throw invalidChampionSelection(
        'The selected team is not first in the final standings',
      );
    }
    return orderedTeamIds;
  }

  const candidateIds = new Set(analysis.tie.candidateTeamIds);
  if (!selectedChampionTeamId) {
    const publicTeams = new Map(
      standings.map((standing) => {
        const candidate = championshipPublicTeam(format, standing);
        return [candidate.teamId, candidate];
      }),
    );
    throw new ConflictException({
      code: ApplicationErrorCode.TOURNAMENT_CHAMPION_TIE_BREAK_REQUIRED,
      message:
        'Organizer selection is required because teams are tied for champion',
      details: {
        candidates: analysis.tie.candidateTeamIds.map((teamId) =>
          publicTeams.get(teamId),
        ),
      },
    });
  }
  if (!candidateIds.has(selectedChampionTeamId)) {
    throw invalidChampionSelection(
      'The selected champion must belong to the tied first-place teams',
    );
  }
  return [
    selectedChampionTeamId,
    ...orderedTeamIds.filter((teamId) => teamId !== selectedChampionTeamId),
  ];
}

function championshipCandidate(format: RoundFormat, standing: unknown) {
  const row = standing as Record<string, unknown>;
  return {
    teamId: String(format === RoundFormat.SWISS ? row.teamId : row.id),
    metrics:
      format === RoundFormat.SWISS
        ? [row.points, row.buchholz, row.buchholzCut1, row.scoreDifference].map(
            numberMetric,
          )
        : [row.points, row.wins, row.scoreDifference].map(numberMetric),
  };
}

function championshipPublicTeam(format: RoundFormat, standing: unknown) {
  const row = standing as Record<string, unknown>;
  const team =
    row.team && typeof row.team === 'object'
      ? (row.team as Record<string, unknown>)
      : null;
  return {
    teamId: String(format === RoundFormat.SWISS ? row.teamId : row.id),
    name: String(format === RoundFormat.SWISS ? team?.name : row.name),
    seed: numberOrNull(format === RoundFormat.SWISS ? team?.seed : row.seed),
  };
}

function numberMetric(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function invalidChampionSelection(message: string) {
  return new ConflictException({
    code: ApplicationErrorCode.TOURNAMENT_CHAMPION_SELECTION_INVALID,
    message,
  });
}
