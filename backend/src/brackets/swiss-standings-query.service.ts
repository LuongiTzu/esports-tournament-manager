import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { MatchStatus, RegistrationStatus, RoundFormat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SwissGenerator } from './generators/swiss.generator';
import { RoundSettingsService } from './round-settings.service';
import { SwissSettings } from './types/round-settings';
import { SwissMatchSnapshot } from './types/swiss';
import type { StandingsClient } from './standings.service';

@Injectable()
export class SwissStandingsQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: RoundSettingsService,
    private readonly generator: SwissGenerator,
  ) {}

  async calculate(roundId: string) {
    return this.calculateWithClient(this.prisma, roundId);
  }

  async calculateWithClient(client: StandingsClient, roundId: string) {
    const round = await client.round.findUnique({
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
    const assignments = await client.roundTeam.findMany({
      where: { roundId },
      orderBy: { createdAt: 'asc' },
      select: {
        seed: true,
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
          .map((assignment) => ({
            ...assignment.team,
            seed: assignment.seed ?? assignment.team.seed,
          }))
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
      : await client.team.findMany({
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
