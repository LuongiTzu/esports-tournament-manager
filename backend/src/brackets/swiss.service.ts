import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus, RegistrationStatus, RoundFormat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SwissGenerator } from './generators/swiss.generator';
import { RoundSettingsService } from './round-settings.service';
import { SwissSettings } from './types/round-settings';
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
        tx.team.findMany({
          where: {
            tournamentId: round.tournamentId,
            status: RegistrationStatus.APPROVED,
          },
          select: { id: true, name: true, seed: true, registeredAt: true },
        }),
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
      const configuredRounds =
        rawSettings &&
        Object.prototype.hasOwnProperty.call(rawSettings, 'numRounds')
          ? settings.numRounds
          : undefined;
      const numRounds = this.generator.resolveNumRounds(
        teams.length,
        configuredRounds,
      );
      const nextRound = currentRound + 1;
      if (nextRound > numRounds) {
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
      await tx.match.createMany({
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
        })),
      });
      return { roundId, bracketRound: nextRound, numRounds, ...result };
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
    const teams = await this.prisma.team.findMany({
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
