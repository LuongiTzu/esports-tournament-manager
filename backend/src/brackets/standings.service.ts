import { Injectable } from '@nestjs/common';
import { MatchStatus, RegistrationStatus, RoundFormat } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SwissService } from './swiss.service';

@Injectable()
export class StandingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly swiss: SwissService,
  ) {}

  async forTournament(
    tournamentId: string,
    rounds: Array<{ id: string; format: RoundFormat }>,
  ) {
    const data: Array<{
      roundId: string;
      format: RoundFormat;
      standings: unknown[];
    }> = [];
    for (const round of rounds) {
      data.push({
        roundId: round.id,
        format: round.format,
        standings:
          round.format === RoundFormat.SWISS
            ? await this.swiss.calculateSwissStandings(round.id)
            : await this.calculateBasic(round.id, tournamentId),
      });
    }
    return { tournamentId, rounds: data };
  }

  private async calculateBasic(roundId: string, tournamentId: string) {
    const [teams, matches] = await Promise.all([
      this.prisma.team.findMany({
        where: { tournamentId, status: RegistrationStatus.APPROVED },
        select: { id: true, name: true, seed: true },
      }),
      this.prisma.match.findMany({
        where: { roundId, status: MatchStatus.COMPLETED },
        select: {
          teamAId: true,
          teamBId: true,
          scoreA: true,
          scoreB: true,
          winnerTeamId: true,
          isBye: true,
        },
      }),
    ]);
    const rows = new Map(
      teams.map((team) => [
        team.id,
        {
          ...team,
          played: 0,
          wins: 0,
          draws: 0,
          losses: 0,
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
        if (match.winnerTeamId === a.id || match.isBye) a.wins++;
        else if (!match.winnerTeamId) a.draws++;
        else a.losses++;
      }
      if (b) {
        b.played++;
        b.scoreDifference += match.scoreB - match.scoreA;
        if (match.winnerTeamId === b.id) b.wins++;
        else if (!match.winnerTeamId) b.draws++;
        else b.losses++;
      }
    }
    return [...rows.values()].sort(
      (a, b) =>
        b.wins - a.wins ||
        b.scoreDifference - a.scoreDifference ||
        (a.seed ?? 9999) - (b.seed ?? 9999),
    );
  }
}
