import { MatchOutcome, RoundFormat } from '@prisma/client';
import {
  GroupStageSettings,
  RoundRobinSettings,
} from '../types/round-settings';

export type StandingTeam = { id: string; name: string; seed: number | null };
export type StandingMatch = {
  teamAId: string | null;
  teamBId: string | null;
  scoreA: number;
  scoreB: number;
  winnerTeamId: string | null;
  outcome: MatchOutcome | null;
  isBye: boolean;
};

export type PointSettings = {
  winPoints: number;
  drawPoints: number;
  lossPoints: number;
  allowDraws: boolean;
};

export function resolvePointSettings(
  format: RoundFormat,
  settings: unknown,
): PointSettings {
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

export function calculateStandingsRows(
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
