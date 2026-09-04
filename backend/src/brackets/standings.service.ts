import { Injectable } from '@nestjs/common';
import {
  MatchStatus,
  Prisma,
  RegistrationStatus,
  RoundFormat,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoundSettingsService } from './round-settings.service';
import { SwissService } from './swiss.service';
import { GroupStageSettings } from './types/round-settings';
import {
  calculateStandingsRows,
  resolvePointSettings,
} from './domain/standings-calculator';

export type StandingsClient = Pick<
  Prisma.TransactionClient,
  'group' | 'match' | 'round' | 'roundTeam' | 'team'
>;

@Injectable()
export class StandingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly swiss: SwissService,
    private readonly settingsService: RoundSettingsService,
  ) {}

  async forTournament(
    tournamentId: string,
    rounds: Array<{ id: string; format: RoundFormat; settings?: unknown }>,
    client: StandingsClient = this.prisma,
  ) {
    const data: Array<{
      roundId: string;
      format: RoundFormat;
      standings: unknown[];
    }> = [];
    for (const round of rounds) {
      let standings: unknown[];
      if (round.format === RoundFormat.SWISS) {
        const rows = await this.swiss.calculateSwissStandings(round.id, client);
        const [teams, assignments] = await Promise.all([
          client.team.findMany({
            where: { id: { in: rows.map((row) => row.teamId) } },
            select: {
              id: true,
              name: true,
              shortName: true,
              logoUrl: true,
              seed: true,
            },
          }),
          client.roundTeam.findMany({
            where: { roundId: round.id },
            select: { teamId: true, seed: true },
          }),
        ]);
        const roundSeeds = new Map(
          assignments.map((assignment) => [assignment.teamId, assignment.seed]),
        );
        const teamsById = new Map(
          teams.map((team) => [
            team.id,
            { ...team, seed: roundSeeds.get(team.id) ?? team.seed },
          ]),
        );
        standings = rows.map((row) => ({
          ...row,
          team: teamsById.get(row.teamId) ?? null,
        }));
      } else if (round.format === RoundFormat.GROUP_STAGE) {
        standings = await this.calculateGroups(
          client,
          round.id,
          round.settings,
        );
      } else if (
        round.format === RoundFormat.PLAYOFF ||
        round.format === RoundFormat.DOUBLE_ELIM
      ) {
        standings = [];
      } else {
        standings = await this.calculateBasic(
          client,
          round.id,
          tournamentId,
          round.format,
          round.settings,
        );
      }
      data.push({ roundId: round.id, format: round.format, standings });
    }
    return { tournamentId, rounds: data };
  }

  private async calculateBasic(
    client: StandingsClient,
    roundId: string,
    tournamentId: string,
    format: RoundFormat,
    rawSettings?: unknown,
  ) {
    const [assignments, matches] = await Promise.all([
      client.roundTeam.findMany({
        where: { roundId },
        orderBy: { createdAt: 'asc' },
        select: {
          seed: true,
          team: {
            select: {
              id: true,
              name: true,
              seed: true,
              tournamentId: true,
              status: true,
            },
          },
        },
      }),
      client.match.findMany({
        where: { roundId, status: MatchStatus.COMPLETED },
        select: matchSelect,
      }),
    ]);
    const teams = assignments.length
      ? assignments
          .map((assignment) => ({
            ...assignment.team,
            seed: assignment.seed ?? assignment.team.seed,
          }))
          .filter(
            (team) =>
              team.tournamentId === tournamentId &&
              team.status === RegistrationStatus.APPROVED,
          )
          .map((team) => ({ id: team.id, name: team.name, seed: team.seed }))
      : await client.team.findMany({
          where: { tournamentId, status: RegistrationStatus.APPROVED },
          select: { id: true, name: true, seed: true },
        });
    const settings = this.settingsService.getEffectiveSettings(
      format,
      rawSettings,
    );
    return calculateStandingsRows(
      teams,
      matches,
      resolvePointSettings(format, settings),
    );
  }

  private async calculateGroups(
    client: StandingsClient,
    roundId: string,
    rawSettings?: unknown,
  ) {
    const [groups, matches, roundAssignments] = await Promise.all([
      client.group.findMany({
        where: { roundId },
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          name: true,
          orderIndex: true,
          teamAssignments: {
            where: { team: { status: RegistrationStatus.APPROVED } },
            select: {
              team: { select: { id: true, name: true, seed: true } },
            },
          },
        },
      }),
      client.match.findMany({
        where: {
          roundId,
          groupId: { not: null },
          status: MatchStatus.COMPLETED,
        },
        select: { groupId: true, ...matchSelect },
      }),
      client.roundTeam.findMany({
        where: { roundId },
        select: { teamId: true, seed: true },
      }),
    ]);
    const roundSeeds = new Map(
      roundAssignments.map((assignment) => [
        assignment.teamId,
        assignment.seed,
      ]),
    );
    const settings = this.settingsService.getEffectiveSettings(
      RoundFormat.GROUP_STAGE,
      rawSettings,
    ) as GroupStageSettings;

    return groups.map((group) => ({
      groupId: group.id,
      name: group.name,
      orderIndex: group.orderIndex,
      standings: (() => {
        const teams = group.teamAssignments.map((assignment) => ({
          ...assignment.team,
          seed: roundSeeds.get(assignment.team.id) ?? assignment.team.seed,
        }));
        const teamIds = new Set(teams.map((team) => team.id));
        return calculateStandingsRows(
          teams,
          matches.filter(
            (match) =>
              match.groupId === group.id &&
              !!match.teamAId &&
              !!match.teamBId &&
              teamIds.has(match.teamAId) &&
              teamIds.has(match.teamBId),
          ),
          resolvePointSettings(RoundFormat.GROUP_STAGE, settings),
        );
      })(),
    }));
  }
}

const matchSelect = {
  teamAId: true,
  teamBId: true,
  scoreA: true,
  scoreB: true,
  winnerTeamId: true,
  outcome: true,
  isBye: true,
} as const;
