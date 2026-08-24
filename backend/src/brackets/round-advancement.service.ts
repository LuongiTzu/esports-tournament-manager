import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  MatchStatus,
  Prisma,
  RegistrationStatus,
  RoundFormat,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoundSettingsService } from './round-settings.service';
import { StandingsService } from './standings.service';
import {
  GroupStageSettings,
  resolveSwissNumberOfRounds,
  SwissSettings,
} from './types/round-settings';

@Injectable()
export class RoundAdvancementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly standings: StandingsService,
    private readonly settingsService: RoundSettingsService,
  ) {}

  async advance(roundId: string) {
    const round = await this.prisma.round.findUnique({
      where: { id: roundId },
      select: {
        id: true,
        tournamentId: true,
        orderIndex: true,
        format: true,
        settings: true,
        matches: {
          select: {
            status: true,
            isActive: true,
            groupId: true,
            bracketRound: true,
          },
        },
      },
    });
    if (!round) throw new NotFoundException('Không tìm thấy vòng đấu');
    if (
      !round.matches.length ||
      round.matches.some(
        (match) =>
          match.isActive !== false && match.status !== MatchStatus.COMPLETED,
      )
    ) {
      throw new BadRequestException('Current round is not complete');
    }
    if (
      round.format === RoundFormat.PLAYOFF ||
      round.format === RoundFormat.DOUBLE_ELIM
    ) {
      return {
        roundId,
        currentRound: {
          id: round.id,
          format: round.format,
          orderIndex: round.orderIndex,
        },
        nextRound: null,
        advanceCount: 0,
        qualifiedTeams: [],
        teamIds: [],
        progressionMode: 'MATCH_LINKAGE',
        prepared: true,
        persisted: true,
      };
    }

    const nextRound = await this.prisma.round.findFirst({
      where: {
        tournamentId: round.tournamentId,
        orderIndex: { gt: round.orderIndex },
      },
      orderBy: { orderIndex: 'asc' },
      select: { id: true, name: true, format: true, settings: true },
    });
    if (!nextRound) throw new BadRequestException('No next round exists');

    const settings = asRecord(round.settings) ?? {};
    const result = await this.standings.forTournament(round.tournamentId, [
      { id: round.id, format: round.format, settings: round.settings },
    ]);

    let configuredAdvanceCount: number | undefined;
    if (round.format === RoundFormat.SWISS) {
      const swissSettings = this.settingsService.getEffectiveSettings(
        RoundFormat.SWISS,
        round.settings,
      ) as SwissSettings;
      const swissStandings = result.rounds[0].standings as Array<{
        teamId: string;
      }>;
      const numberOfRounds = resolveSwissNumberOfRounds(
        swissStandings.length,
        swissSettings.numberOfRounds,
      );
      const currentSwissRound = Math.max(
        0,
        ...round.matches.map((match) => match.bracketRound ?? 0),
      );
      if (currentSwissRound !== numberOfRounds) {
        throw new BadRequestException(
          'Swiss advancement is only available after the final configured round',
        );
      }
      configuredAdvanceCount = swissSettings.advancingTeamCount;
    }

    if (round.format === RoundFormat.GROUP_STAGE) {
      const groupSettings = this.settingsService.getEffectiveSettings(
        RoundFormat.GROUP_STAGE,
        round.settings,
      ) as GroupStageSettings;
      const { numberOfGroups, advancingTeamsPerGroup, meetingsPerPair } =
        groupSettings;

      const groups = result.rounds[0].standings as Array<{
        groupId: string;
        name: string;
        orderIndex: number;
        standings: Array<{ teamId?: string; id?: string }>;
      }>;
      if (groups.length !== numberOfGroups || groups.length === 0) {
        throw new BadRequestException(
          'Persisted groups do not match GROUP_STAGE settings',
        );
      }
      const teamsPerGroup = groups[0].standings.length;
      if (
        teamsPerGroup < 2 ||
        groups.some((group) => group.standings.length !== teamsPerGroup) ||
        advancingTeamsPerGroup >= teamsPerGroup
      ) {
        throw new BadRequestException(
          'Persisted groups do not match GROUP_STAGE settings',
        );
      }

      const matchesPerGroup =
        ((teamsPerGroup * (teamsPerGroup - 1)) / 2) * meetingsPerPair;
      if (
        groups.some(
          (group) =>
            round.matches.filter((match) => match.groupId === group.groupId)
              .length !== matchesPerGroup,
        )
      ) {
        throw new BadRequestException('Current round is not complete');
      }

      const qualifiedGroups = groups.map((group) => ({
        groupId: group.groupId,
        name: group.name,
        orderIndex: group.orderIndex,
        teamIds: group.standings
          .slice(0, advancingTeamsPerGroup)
          .map((row) => row.teamId ?? row.id!),
      }));
      const teamIds = qualifiedGroups.flatMap((group) => group.teamIds);
      return this.persistAdvancement({
        round,
        nextRound,
        teamIds,
        advanceCountPerGroup: advancingTeamsPerGroup,
        groups: qualifiedGroups,
      });
    }

    configuredAdvanceCount ??= Number(settings.advanceCount ?? 0);
    if (
      !Number.isInteger(configuredAdvanceCount) ||
      configuredAdvanceCount < 1
    ) {
      throw new BadRequestException(
        'Round format does not define advanceCount',
      );
    }
    const standings = result.rounds[0].standings as Array<{
      teamId?: string;
      id?: string;
    }>;
    const teamIds = standings
      .slice(0, configuredAdvanceCount)
      .map((row) => row.teamId ?? row.id!);
    return this.persistAdvancement({ round, nextRound, teamIds });
  }

  private async persistAdvancement(input: {
    round: {
      id: string;
      tournamentId: string;
      orderIndex: number;
      format: RoundFormat;
    };
    nextRound: {
      id: string;
      name: string;
      format: RoundFormat;
      settings: unknown;
    };
    teamIds: string[];
    advanceCountPerGroup?: number;
    groups?: Array<{
      groupId: string;
      name: string;
      orderIndex: number;
      teamIds: string[];
    }>;
  }) {
    const uniqueTeamIds = [...new Set(input.teamIds)];
    if (
      !uniqueTeamIds.length ||
      uniqueTeamIds.length !== input.teamIds.length
    ) {
      throw new BadRequestException('Invalid qualified team selection');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "rounds" WHERE "id" = ${input.round.id} FOR UPDATE`,
      );
      const current = await tx.round.findUnique({
        where: { id: input.round.id },
        select: {
          id: true,
          tournamentId: true,
          orderIndex: true,
          format: true,
          matches: { select: { status: true } },
        },
      });
      if (!current) {
        throw new NotFoundException('KhÃ´ng tÃ¬m tháº¥y vÃ²ng Ä‘áº¥u');
      }
      if (
        current.tournamentId !== input.round.tournamentId ||
        current.format !== input.round.format ||
        !current.matches.length ||
        current.matches.some((match) => match.status !== MatchStatus.COMPLETED)
      ) {
        throw new BadRequestException('Current round is not complete');
      }

      const durableNextRound = await tx.round.findFirst({
        where: {
          tournamentId: current.tournamentId,
          orderIndex: { gt: current.orderIndex },
        },
        orderBy: { orderIndex: 'asc' },
        select: { id: true, name: true, format: true, settings: true },
      });
      if (!durableNextRound || durableNextRound.id !== input.nextRound.id) {
        throw new BadRequestException('Next round configuration changed');
      }

      const existing = await tx.roundTeam.findFirst({
        where: {
          OR: [
            { advancedFromRoundId: current.id },
            { roundId: durableNextRound.id },
          ],
        },
        select: { roundId: true },
      });
      if (existing) {
        throw new ConflictException('Round advancement is already persisted');
      }

      const eligible = await tx.team.findMany({
        where: {
          id: { in: uniqueTeamIds },
          tournamentId: current.tournamentId,
          status: RegistrationStatus.APPROVED,
        },
        select: { id: true, name: true, seed: true },
      });
      if (eligible.length !== uniqueTeamIds.length) {
        throw new BadRequestException(
          'Every qualified team must be approved and belong to the tournament',
        );
      }

      validateTeamCount(
        durableNextRound.format,
        uniqueTeamIds.length,
        durableNextRound.settings,
      );

      await tx.roundTeam.createMany({
        data: uniqueTeamIds.map((teamId) => ({
          roundId: durableNextRound.id,
          teamId,
          advancedFromRoundId: current.id,
        })),
      });
      const eligibleById = new Map(eligible.map((team) => [team.id, team]));
      const qualifiedTeams = uniqueTeamIds.map((teamId) =>
        eligibleById.get(teamId)!,
      );

      return {
        roundId: current.id,
        currentRound: {
          id: current.id,
          format: current.format,
          orderIndex: current.orderIndex,
        },
        nextRound: {
          id: durableNextRound.id,
          name: durableNextRound.name,
          format: durableNextRound.format,
        },
        advanceCount: qualifiedTeams.length,
        ...(input.advanceCountPerGroup
          ? { advanceCountPerGroup: input.advanceCountPerGroup }
          : {}),
        ...(input.groups ? { groups: input.groups } : {}),
        qualifiedTeams,
        teamIds: qualifiedTeams.map((team) => team.id),
        progressionMode: 'ROUND_PARTICIPANTS',
        prepared: true,
        persisted: true,
      };
    });
  }
}

function validateTeamCount(format: RoundFormat, count: number, raw: unknown) {
  const minimum = format === RoundFormat.DOUBLE_ELIM ? 4 : 2;
  if (count < minimum) {
    throw new BadRequestException(
      `${format} requires at least ${minimum} approved teams`,
    );
  }
  const settings = asRecord(raw);
  if (format === RoundFormat.GROUP_STAGE) {
    const numberOfGroups = Number(
      settings?.numberOfGroups ?? settings?.numGroups,
    );
    if (
      !Number.isInteger(numberOfGroups) ||
      numberOfGroups < 2 ||
      numberOfGroups > count ||
      count % numberOfGroups !== 0
    ) {
      throw new BadRequestException(
        `GROUP_STAGE requires ${count} approved teams to divide equally into ${numberOfGroups} groups`,
      );
    }
  }
  if (count > 256)
    throw new BadRequestException('A round supports at most 256 teams');
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null;
}
