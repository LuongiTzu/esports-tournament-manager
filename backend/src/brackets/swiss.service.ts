import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import {
  MatchOutcome,
  MatchStatus,
  Prisma,
  RegistrationStatus,
  RoundFormat,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SwissGenerator } from './generators/swiss.generator';
import { RoundSettingsService } from './round-settings.service';
import {
  resolveSwissNumberOfRounds,
  SwissSettings,
} from './types/round-settings';
import { SwissMatchSnapshot } from './types/swiss';

@Injectable()
export class SwissService {
  private readonly logger = new Logger(SwissService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: RoundSettingsService,
    private readonly generator: SwissGenerator,
  ) {}

  async generateNextSwissRound(roundId: string) {
    return this.prisma.$transaction(async (tx) => {
      // Serialize generation for this logical Swiss round so concurrent calls
      // cannot both observe the same last generated bracketRound.
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "rounds" WHERE "id" = ${roundId} FOR UPDATE`,
      );
      const round = await tx.round.findUnique({
        where: { id: roundId },
        select: {
          id: true,
          format: true,
          settings: true,
          bestOf: true,
          tournamentId: true,
        },
      });
      if (!round) throw new NotFoundException('Round not found');
      if (round.format !== RoundFormat.SWISS) {
        throw new BadRequestException('Round format must be SWISS');
      }

      const [teams, matches] = await Promise.all([
        (async () => {
          const assignments = await tx.roundTeam.findMany({
            where: { roundId },
            orderBy: { createdAt: 'asc' },
            select: {
              team: {
                select: {
                  id: true,
                  name: true,
                  seed: true,
                  registeredAt: true,
                  tournamentId: true,
                  status: true,
                },
              },
            },
          });
          if (assignments.length) {
            return assignments
              .map((assignment) => assignment.team)
              .filter(
                (team) =>
                  team.tournamentId === round.tournamentId &&
                  team.status === RegistrationStatus.APPROVED,
              )
              .map((team) => ({
                id: team.id,
                name: team.name,
                seed: team.seed,
                registeredAt: team.registeredAt,
              }));
          }
          return tx.team.findMany({
            where: {
              tournamentId: round.tournamentId,
              status: RegistrationStatus.APPROVED,
            },
            select: { id: true, name: true, seed: true, registeredAt: true },
          });
        })(),
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
          },
          orderBy: [{ bracketRound: 'asc' }, { matchNumber: 'asc' }],
        }),
      ]);
      if (teams.length < 2) {
        throw new BadRequestException(
          'SWISS requires at least 2 approved teams',
        );
      }
      const currentRound = Math.max(
        0,
        ...matches.map((match) => match.bracketRound ?? 0),
      );
      if (
        currentRound > 0 &&
        matches.some(
          (match) =>
            match.bracketRound === currentRound &&
            match.status !== MatchStatus.COMPLETED,
        )
      ) {
        throw new BadRequestException('Current Swiss round is not completed');
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
      const nextRound = currentRound + 1;
      if (nextRound > numberOfRounds) {
        throw new BadRequestException(
          'All configured Swiss rounds are complete',
        );
      }

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

  async calculateSwissStandings(roundId: string) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      select: {
        format: true,
        settings: true,
        tournamentId: true,
        matches: {
          select: {
            teamAId: true,
            teamBId: true,
            scoreA: true,
            scoreB: true,
            bracketRound: true,
            isBye: true,
            status: true,
          },
        },
      },
    });
    if (!round) throw new NotFoundException('Round not found');
    if (round.format !== RoundFormat.SWISS) {
      throw new BadRequestException('Round format must be SWISS');
    }
    const assignments = await this.prisma.roundTeam.findMany({
      where: { roundId },
      orderBy: { createdAt: 'asc' },
      select: {
        team: {
          select: {
            id: true,
            name: true,
            seed: true,
            registeredAt: true,
            tournamentId: true,
            status: true,
          },
        },
      },
    });
    const teams = assignments.length
      ? assignments
          .map((assignment) => assignment.team)
          .filter(
            (team) =>
              team.tournamentId === round.tournamentId &&
              team.status === RegistrationStatus.APPROVED,
          )
          .map((team) => ({
            id: team.id,
            name: team.name,
            seed: team.seed,
            registeredAt: team.registeredAt,
          }))
      : await this.prisma.team.findMany({
          where: {
            tournamentId: round.tournamentId,
            status: RegistrationStatus.APPROVED,
          },
          select: { id: true, name: true, seed: true, registeredAt: true },
        });
    const settings = (await this.settingsService.normalizeForFormat(
      RoundFormat.SWISS,
      asRecord(round.settings),
    )) as SwissSettings;
    return this.generator.calculateStandings(
      teams,
      toSnapshots(round.matches),
      settings,
    );
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
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
