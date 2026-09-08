import { RoundFormat } from '@prisma/client';
import { SwissGenerator } from './generators/swiss.generator';
import { RoundSettingsMap, SwissSettings } from './types/round-settings';
import { SwissMatchSnapshot } from './types/swiss';

interface ViewTeam {
  id: string;
  name: string;
  seed: number | null;
}

interface ViewMatch {
  id: string;
  bracketRound: number | null;
  matchNumber: number | null;
  status: string;
  isActive: boolean;
  isBye: boolean;
  slots: { A: ViewTeam | null; B: ViewTeam | null };
  score: { A: number; B: number };
  winner: { id: string } | null;
}

export interface SwissRecord {
  wins: number;
  losses: number;
}

export interface SwissRecordGroup {
  id: string;
  bracketRound: number;
  records: SwissRecord[];
  entries: Array<{
    matchId: string;
    A: SwissRecord | null;
    B: SwissRecord | null;
  }>;
}

export interface SwissBracketView {
  groups: SwissRecordGroup[];
  links: Array<{
    from: string;
    to: string;
    result: 'winner' | 'loser';
  }>;
}

/** Shared by the public, management and generation-preview bracket responses. */
export function withSwissBracketView<
  T extends {
    round: { format: RoundFormat; settings: RoundSettingsMap[RoundFormat] };
    matches: ViewMatch[];
  },
>(bracket: T): T & { swiss: SwissBracketView | null } {
  return {
    ...bracket,
    swiss:
      bracket.round.format === RoundFormat.SWISS
        ? buildSwissBracketView(
            bracket.matches,
            bracket.round.settings as SwissSettings,
          )
        : null,
  };
}

/** Historical records are recalculated from persisted results, never stored separately. */
function buildSwissBracketView(
  matches: ViewMatch[],
  settings: SwissSettings,
): SwissBracketView {
  const ordered = matches
    .filter((match) => match.isActive)
    .sort(
      (a, b) =>
        (a.bracketRound ?? 0) - (b.bracketRound ?? 0) ||
        (a.matchNumber ?? 0) - (b.matchNumber ?? 0) ||
        a.id.localeCompare(b.id),
    );
  const teams = new Map(
    ordered
      .flatMap((match) => [match.slots.A, match.slots.B])
      .filter((team): team is ViewTeam => team !== null)
      .map((team) => [team.id, team]),
  );
  // Only wins/losses are used. Registration order affects ranking tie-breaks only.
  const calculatorTeams = [...teams.values()].map((team) => ({
    ...team,
    registeredAt: new Date(0),
  }));
  const snapshots: SwissMatchSnapshot[] = ordered
    .filter((match) => match.slots.A && match.bracketRound !== null)
    .map((match) => ({
      teamAId: match.slots.A!.id,
      teamBId: match.slots.B?.id ?? null,
      scoreA: match.score.A,
      scoreB: match.score.B,
      bracketRound: match.bracketRound!,
      isBye: match.isBye,
      completed: match.status === 'COMPLETED',
    }));
  const calculator = new SwissGenerator();
  const groups = new Map<string, SwissRecordGroup>();
  const groupByMatch = new Map<string, string>();
  const iterations = [...new Set(ordered.map((match) => match.bracketRound))];
  for (const iteration of iterations) {
    const standings = calculator.calculateStandings(
      calculatorTeams,
      snapshots.filter(
        (match) => iteration !== null && match.bracketRound < iteration,
      ),
      settings,
    );
    const records = new Map(
      standings.map((row) => [
        row.teamId,
        { wins: row.wins, losses: row.losses },
      ]),
    );
    for (const match of ordered.filter(
      (item) => item.bracketRound === iteration,
    )) {
      const A = match.slots.A ? (records.get(match.slots.A.id) ?? null) : null;
      const B = match.slots.B ? (records.get(match.slots.B.id) ?? null) : null;
      const distinct = [
        ...new Map(
          [A, B]
            .filter((record): record is SwissRecord => record !== null)
            .map((record) => [recordKey(record), record]),
        ).values(),
      ].sort((a, b) => b.wins - a.wins || a.losses - b.losses);
      const id = `swiss-${iteration ?? 0}-${distinct.map(recordKey).join('_') || 'unassigned'}`;
      const group = groups.get(id) ?? {
        id,
        bracketRound: iteration ?? 0,
        records: distinct,
        entries: [],
      };
      group.entries.push({ matchId: match.id, A, B });
      groups.set(id, group);
      groupByMatch.set(match.id, id);
    }
  }
  // Connect only teams actually paired in successive iterations; no future pairing is predicted.
  const previousByTeam = new Map<string, ViewMatch>();
  const links = new Map<string, SwissBracketView['links'][number]>();
  for (const iteration of iterations) {
    const current = ordered.filter((match) => match.bracketRound === iteration);
    for (const match of current) {
      for (const team of [match.slots.A, match.slots.B]) {
        const previous = team && previousByTeam.get(team.id);
        if (
          !team ||
          !previous ||
          !previous.winner ||
          previous.bracketRound === null ||
          iteration !== previous.bracketRound + 1 ||
          (previous.status !== 'COMPLETED' && !previous.isBye)
        )
          continue;
        const from = groupByMatch.get(previous.id)!;
        const to = groupByMatch.get(match.id)!;
        const result = previous.winner.id === team.id ? 'winner' : 'loser';
        links.set(`${from}:${to}:${result}`, { from, to, result });
      }
    }
    for (const match of current) {
      for (const team of [match.slots.A, match.slots.B]) {
        if (team) previousByTeam.set(team.id, match);
      }
    }
  }
  return { groups: [...groups.values()], links: [...links.values()] };
}

function recordKey(record: SwissRecord) {
  return `${record.wins}-${record.losses}`;
}
