import { Injectable } from '@nestjs/common';
import { MatchStatus, RegistrationStatus, RoundFormat } from '@prisma/client';
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
  isBye: boolean;
};
type PointSettings = Pick<
  RoundRobinSettings,
  'pointsWin' | 'pointsDraw' | 'pointsLoss'
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
  ) {
    const data: Array<{
      roundId: string;
      format: RoundFormat;
      standings: unknown[];
    }> = [];
    for (const round of rounds) {
      let standings: unknown[];
      if (round.format === RoundFormat.SWISS) {
        standings = await this.swiss.calculateSwissStandings(round.id);
      } else if (round.format === RoundFormat.GROUP_STAGE) {
        standings = await this.calculateGroups(round.id, round.settings);
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
    const [teams, matches] = await Promise.all([
      this.prisma.team.findMany({
        where: { tournamentId, status: RegistrationStatus.APPROVED },
        select: { id: true, name: true, seed: true },
      }),
      this.prisma.match.findMany({
        where: { roundId, status: MatchStatus.COMPLETED },
        select: matchSelect,
      }),
    ]);
    const settings = this.settingsService.getEffectiveSettings(
      format,
      rawSettings,
    ) as Partial<PointSettings>;
    return calculateRows(teams, matches, pointSettings(settings));
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
          pointSettings(settings),
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
  isBye: true,
} as const;

function pointSettings(settings: Partial<PointSettings>): PointSettings {
  return {
    pointsWin: settings.pointsWin ?? 3,
    pointsDraw: settings.pointsDraw ?? 1,
    pointsLoss: settings.pointsLoss ?? 0,
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
    if (a) {
      a.played++;
      a.scoreDifference += match.scoreA - match.scoreB;
      if (match.winnerTeamId === a.id || match.isBye) {
        a.wins++;
        a.points += points.pointsWin;
      } else if (!match.winnerTeamId) {
        a.draws++;
        a.points += points.pointsDraw;
      } else {
        a.losses++;
        a.points += points.pointsLoss;
      }
    }
    if (b) {
      b.played++;
      b.scoreDifference += match.scoreB - match.scoreA;
      if (match.winnerTeamId === b.id) {
        b.wins++;
        b.points += points.pointsWin;
      } else if (!match.winnerTeamId) {
        b.draws++;
        b.points += points.pointsDraw;
      } else {
        b.losses++;
        b.points += points.pointsLoss;
      }
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      b.points - a.points ||
      b.wins - a.wins ||
      b.scoreDifference - a.scoreDifference ||
      (a.seed ?? 9999) - (b.seed ?? 9999),
  );
}
