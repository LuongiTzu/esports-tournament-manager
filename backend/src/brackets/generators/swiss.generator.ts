import { Injectable } from '@nestjs/common';
import { RoundFormat } from '@prisma/client';
import {
  BracketTeam,
  BracketGeneratorInput,
  IBracketGenerator,
  MatchDraft,
} from '../types/bracket-generator';
import {
  SwissMatchSnapshot,
  SwissPairingInput,
  SwissPairingResult,
  SwissStanding,
} from '../types/swiss';
import { SwissSettings } from '../types/round-settings';

@Injectable()
export class SwissGenerator implements IBracketGenerator<
  typeof RoundFormat.SWISS
> {
  readonly format = RoundFormat.SWISS;

  generate(
    input: BracketGeneratorInput<typeof RoundFormat.SWISS>,
  ): MatchDraft[] {
    return this.generateNext({
      ...input,
      matches: [],
      bracketRound: 1,
    }).matches;
  }

  resolveNumRounds(teamCount: number, configuredNumRounds?: number): number {
    return configuredNumRounds ?? Math.ceil(Math.log2(teamCount));
  }

  calculateStandings(
    teams: readonly BracketTeam[],
    matches: readonly SwissMatchSnapshot[],
    settings: SwissSettings,
  ): SwissStanding[] {
    const completed = matches.filter((match) => match.completed || match.isBye);
    const rows = new Map<
      string,
      Omit<SwissStanding, 'rank' | 'buchholz' | 'buchholzCut1'>
    >(
      teams.map((team) => [
        team.id,
        {
          teamId: team.id,
          points: 0,
          wins: 0,
          draws: 0,
          losses: 0,
          byes: 0,
          scoreDifference: 0,
          opponents: [],
        },
      ]),
    );

    for (const match of completed) {
      const a = rows.get(match.teamAId);
      if (!a) continue;
      if (match.isBye || match.teamBId === null) {
        a.points += settings.pointsWin;
        a.wins++;
        a.byes++;
        continue;
      }
      const b = rows.get(match.teamBId);
      if (!b) continue;
      a.opponents.push(b.teamId);
      b.opponents.push(a.teamId);
      a.scoreDifference += match.scoreA - match.scoreB;
      b.scoreDifference += match.scoreB - match.scoreA;
      if (match.scoreA > match.scoreB) {
        a.points += settings.pointsWin;
        b.points += settings.pointsLoss;
        a.wins++;
        b.losses++;
      } else if (match.scoreB > match.scoreA) {
        b.points += settings.pointsWin;
        a.points += settings.pointsLoss;
        b.wins++;
        a.losses++;
      } else {
        a.points += settings.pointsDraw;
        b.points += settings.pointsDraw;
        a.draws++;
        b.draws++;
      }
    }

    const withBuchholz: SwissStanding[] = [...rows.values()].map((row) => {
      const opponentPoints = row.opponents.map(
        (opponentId) => rows.get(opponentId)?.points ?? 0,
      );
      const buchholz = opponentPoints.reduce((sum, points) => sum + points, 0);
      return {
        ...row,
        rank: 0,
        buchholz,
        buchholzCut1:
          opponentPoints.length === 0
            ? 0
            : buchholz - Math.min(...opponentPoints),
      };
    });

    const teamOrder = new Map(
      sortTeams(teams).map((team, index) => [team.id, index]),
    );
    withBuchholz.sort((a, b) => {
      const base =
        b.points - a.points ||
        b.buchholz - a.buchholz ||
        b.buchholzCut1 - a.buchholzCut1;
      if (base !== 0) return base;
      const headToHead = headToHeadPoints(
        a.teamId,
        b.teamId,
        completed,
        settings,
      );
      if (headToHead !== 0) return -headToHead;
      return (
        b.scoreDifference - a.scoreDifference ||
        (teamOrder.get(a.teamId) ?? 0) - (teamOrder.get(b.teamId) ?? 0)
      );
    });
    return withBuchholz.map((standing, index) => ({
      ...standing,
      rank: index + 1,
    }));
  }

  generateNext(input: SwissPairingInput): SwissPairingResult {
    validateTeams(input.teams);
    if (input.bracketRound === 1) return this.firstRound(input);

    const standings = this.calculateStandings(
      input.teams,
      input.matches,
      input.settings,
    );
    const played = playedPairs(input.matches);
    const warnings: string[] = [];
    const pool = [...standings];
    let byeTeamId: string | null = null;
    if (pool.length % 2 === 1) {
      const eligible = [...pool]
        .reverse()
        .find((standing) => standing.byes === 0);
      const bye = eligible ?? pool[pool.length - 1];
      byeTeamId = bye.teamId;
      pool.splice(
        pool.findIndex((standing) => standing.teamId === bye.teamId),
        1,
      );
    }

    let pairs = pairWithBacktracking(pool, played, false, 20000);
    if (!pairs) {
      pairs = pairWithBacktracking(pool, played, true, 20000);
      warnings.push(
        `Swiss round ${input.bracketRound}: rematch was mathematically unavoidable`,
      );
    }
    if (!pairs) throw new Error('Unable to produce Swiss pairings');

    const matches = pairs.map(([teamAId, teamBId], index) =>
      swissDraft(input.bracketRound, index + 1, teamAId, teamBId, input.bestOf),
    );
    if (byeTeamId) {
      matches.push(
        swissDraft(
          input.bracketRound,
          matches.length + 1,
          byeTeamId,
          null,
          input.bestOf,
        ),
      );
    }
    return { matches, warnings };
  }

  private firstRound(input: SwissPairingInput): SwissPairingResult {
    const ordered = sortTeams(input.teams);
    const bye = ordered.length % 2 === 1 ? ordered.pop()! : null;
    const half = ordered.length / 2;
    const matches = ordered
      .slice(0, half)
      .map((team, index) =>
        swissDraft(
          1,
          index + 1,
          team.id,
          ordered[index + half].id,
          input.bestOf,
        ),
      );
    if (bye)
      matches.push(
        swissDraft(1, matches.length + 1, bye.id, null, input.bestOf),
      );
    return { matches, warnings: [] };
  }
}

function sortTeams(teams: readonly BracketTeam[]): BracketTeam[] {
  return [...teams].sort((a, b) => {
    if (a.seed !== null && b.seed !== null)
      return a.seed - b.seed || a.id.localeCompare(b.id);
    if (a.seed !== null) return -1;
    if (b.seed !== null) return 1;
    return (
      a.registeredAt.getTime() - b.registeredAt.getTime() ||
      a.id.localeCompare(b.id)
    );
  });
}

function validateTeams(teams: readonly BracketTeam[]): void {
  if (teams.length < 2) throw new RangeError('SWISS requires at least 2 teams');
  if (new Set(teams.map((team) => team.id)).size !== teams.length) {
    throw new Error('SWISS team IDs must be unique');
  }
}

function swissDraft(
  round: number,
  number: number,
  a: string,
  b: string | null,
  bestOf: number,
): MatchDraft {
  return {
    key: `swiss-${round}-${number}`,
    teamA: { teamId: a },
    teamB: { teamId: b },
    bracketRound: round,
    bracketType: null,
    matchNumber: number,
    isBye: b === null,
    bestOf,
    nextMatchKey: null,
    nextMatchSlot: null,
    loserNextMatchKey: null,
    loserNextMatchSlot: null,
  };
}

function playedPairs(matches: readonly SwissMatchSnapshot[]): Set<string> {
  return new Set(
    matches
      .filter((match) => match.teamBId !== null)
      .map((match) => pairKey(match.teamAId, match.teamBId!)),
  );
}

function pairKey(a: string, b: string): string {
  return [a, b].sort().join(':');
}

function pairWithBacktracking(
  teams: readonly SwissStanding[],
  played: Set<string>,
  allowRematch: boolean,
  limit: number,
): Array<[string, string]> | null {
  let visited = 0;
  const search = (
    remaining: readonly SwissStanding[],
  ): Array<[string, string]> | null => {
    if (++visited > limit) return null;
    if (remaining.length === 0) return [];
    const first = remaining[0];
    const candidates = remaining
      .slice(1)
      .sort(
        (a, b) =>
          Math.abs(first.points - a.points) -
            Math.abs(first.points - b.points) || a.rank - b.rank,
      );
    for (const candidate of candidates) {
      if (!allowRematch && played.has(pairKey(first.teamId, candidate.teamId)))
        continue;
      const rest = remaining.filter(
        (team) =>
          team.teamId !== first.teamId && team.teamId !== candidate.teamId,
      );
      const tail = search(rest);
      if (tail) return [[first.teamId, candidate.teamId], ...tail];
    }
    return null;
  };
  return search(teams);
}

function headToHeadPoints(
  a: string,
  b: string,
  matches: readonly SwissMatchSnapshot[],
  settings: SwissSettings,
): number {
  let difference = 0;
  for (const match of matches) {
    if (
      match.teamBId === null ||
      pairKey(match.teamAId, match.teamBId) !== pairKey(a, b)
    )
      continue;
    const aScore = match.teamAId === a ? match.scoreA : match.scoreB;
    const bScore = match.teamAId === a ? match.scoreB : match.scoreA;
    difference +=
      aScore > bScore
        ? settings.pointsWin - settings.pointsLoss
        : aScore < bScore
          ? settings.pointsLoss - settings.pointsWin
          : 0;
  }
  return difference;
}
