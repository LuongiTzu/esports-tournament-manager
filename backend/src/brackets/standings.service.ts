import { Injectable } from '@nestjs/common';
import {
  MatchOutcome,
  MatchStatus,
  RegistrationStatus,
  RoundFormat,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RoundSettingsService } from './round-settings.service';
import { SwissService } from './swiss.service';
import { GroupStageSettings, RoundRobinSettings } from './types/round-settings';

type StandingTeam = { id: string; name: string; seed: number | null };
type StandingMatch = {
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
  outcome: MatchOutcome | null;
  isBye: boolean;
};
type PointSettings = {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  allowDraws: boolean;
};

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
  ) {
    const data: Array<{
      roundId: string;
      format: RoundFormat;
      standings: unknown[];
    }> = [];
    for (const round of rounds) {
      let standings: unknown[];
      if (round.format === RoundFormat.SWISS) {
        const rows = await this.swiss.calculateSwissStandings(round.id);
        const teams = await this.prisma.team.findMany({
          where: { id: { in: rows.map((row) => row.teamId) } },
          select: {
            id: true,
            name: true,
            shortName: true,
            logoUrl: true,
            seed: true,
          },
        });
        const teamsById = new Map(teams.map((team) => [team.id, team]));
        standings = rows.map((row) => ({
          ...row,
          team: teamsById.get(row.teamId) ?? null,
        }));
      } else if (round.format === RoundFormat.GROUP_STAGE) {
        standings = await this.calculateGroups(round.id, round.settings);
      } else if (
        round.format === RoundFormat.PLAYOFF ||
        round.format === RoundFormat.DOUBLE_ELIM
      ) {
        standings = [];
      } else {
        standings = await this.calculateBasic(
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
    roundId: string,
    tournamentId: string,
    format: RoundFormat,
    rawSettings?: unknown,
  ) {
    const [assignments, matches] = await Promise.all([
      this.prisma.roundTeam.findMany({
        where: { roundId },
        orderBy: { createdAt: 'asc' },
        select: {
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
      this.prisma.match.findMany({
        where: { roundId, status: MatchStatus.COMPLETED },
        select: matchSelect,
      }),
    ]);
    const teams = assignments.length
      ? assignments
          .map((assignment) => assignment.team)
          .filter(
            (team) =>
              team.tournamentId === tournamentId &&
              team.status === RegistrationStatus.APPROVED,
          )
          .map((team) => ({ id: team.id, name: team.name, seed: team.seed }))
      : await this.prisma.team.findMany({
          where: { tournamentId, status: RegistrationStatus.APPROVED },
          select: { id: true, name: true, seed: true },
        });
    const settings = this.settingsService.getEffectiveSettings(
      format,
      rawSettings,
    );
    return calculateRows(teams, matches, pointSettings(format, settings));
  }

  private async calculateGroups(roundId: string, rawSettings?: unknown) {
    const [groups, matches] = await Promise.all([
      this.prisma.group.findMany({
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
      this.prisma.match.findMany({
        where: {
          roundId,
          groupId: { not: null },
          status: MatchStatus.COMPLETED,
        },
        select: { groupId: true, ...matchSelect },
      }),
    ]);
    const settings = this.settingsService.getEffectiveSettings(
      RoundFormat.GROUP_STAGE,
      rawSettings,
    ) as GroupStageSettings;

    return groups.map((group) => ({
      groupId: group.id,
      name: group.name,
      orderIndex: group.orderIndex,
      standings: (() => {
        const teams = group.teamAssignments.map(
          (assignment) => assignment.team,
        );
        const teamIds = new Set(teams.map((team) => team.id));
        return calculateRows(
          teams,
          matches.filter(
            (match) =>
              match.groupId === group.id &&
              !!match.teamAId &&
              !!match.teamBId &&
              teamIds.has(match.teamAId) &&
              teamIds.has(match.teamBId),
          ),
          pointSettings(RoundFormat.GROUP_STAGE, settings),
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

function pointSettings(format: RoundFormat, settings: unknown): PointSettings {
  const values = settings as Record<string, unknown>;
  if (format === RoundFormat.ROUND_ROBIN) {
    const roundRobin = settings as RoundRobinSettings;
    return {
      winPoints: roundRobin.winPoints,
      drawPoints: roundRobin.drawPoints,
      lossPoints: roundRobin.lossPoints,
      allowDraws: roundRobin.allowDraws,
    };
  }
  if (format === RoundFormat.GROUP_STAGE) {
    const groupStage = settings as GroupStageSettings;
    return {
      winPoints: groupStage.winPoints,
      drawPoints: groupStage.drawPoints,
      lossPoints: groupStage.lossPoints,
      allowDraws: groupStage.allowDraws,
    };
  }
  return {
    winPoints: Number(values.pointsWin ?? 3),
    drawPoints: Number(values.pointsDraw ?? 1),
    lossPoints: Number(values.pointsLoss ?? 0),
    allowDraws: false,
  };
}

function calculateRows(
  teams: StandingTeam[],
  matches: StandingMatch[],
  points: PointSettings,
) {
  const rows = new Map(
    teams.map((team) => [
      team.id,
      {
        ...team,
        played: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        points: 0,
        scoreDifference: 0,
      },
    ]),
  );
  for (const match of matches) {
    const a = match.teamAId ? rows.get(match.teamAId) : undefined;
    const b = match.teamBId ? rows.get(match.teamBId) : undefined;
    const isDraw = match.outcome === MatchOutcome.DRAW;
    if (!match.isBye && !match.winnerTeamId && !isDraw) continue;
    if (a) {
      a.played++;
      a.scoreDifference += match.scoreA - match.scoreB;
      if (match.winnerTeamId === a.id || match.isBye) {
        a.wins++;
        a.points += points.winPoints;
      } else if (isDraw) {
        a.draws++;
        if (points.allowDraws) a.points += points.drawPoints;
      } else {
        a.losses++;
        a.points += points.lossPoints;
      }
    }
    if (b) {
      b.played++;
      b.scoreDifference += match.scoreB - match.scoreA;
      if (match.winnerTeamId === b.id) {
        b.wins++;
        b.points += points.winPoints;
      } else if (isDraw) {
        b.draws++;
        if (points.allowDraws) b.points += points.drawPoints;
      } else {
        b.losses++;
        b.points += points.lossPoints;
      }
    }
  }
  return [...rows.values()]
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.wins - a.wins ||
        b.scoreDifference - a.scoreDifference ||
        (a.seed ?? 9999) - (b.seed ?? 9999),
    )
    .map((row, index) => ({ ...row, rank: index + 1 }));
}
