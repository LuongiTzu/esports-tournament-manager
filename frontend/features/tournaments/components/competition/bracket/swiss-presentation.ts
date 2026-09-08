import type {
  RoundBracket,
  RoundStandings,
  SwissRecordGroup,
  SwissStanding,
} from "@/features/tournaments/types";
import type { BracketLayout } from "./bracket-presentation";

export const SWISS_SHEET = {
  cardWidth: 264,
  cardHeight: 60,
  columnGap: 62,
  rowGap: 30,
  padding: 36,
  heading: 36,
  footer: 28,
  sourceY: 30,
  slotAY: 30,
  slotBY: 30,
};

interface PositionedSwissGroup {
  group: SwissRecordGroup;
  x: number;
  y: number;
  height: number;
}
interface SwissResultGroup {
  key: string;
  wins: number;
  losses: number;
  qualified: boolean;
  teams: SwissStanding[];
  x: number;
  y: number;
  height: number;
}
export interface SwissBracketLayout extends BracketLayout {
  groups: PositionedSwissGroup[];
  results: SwissResultGroup[];
}

/** Arrange backend record groups. This never counts wins or predicts a Swiss pairing. */
export function layoutSwissBracket(
  bracket: RoundBracket,
  standings?: RoundStandings,
  numberOfRounds?: number,
): SwissBracketLayout {
  const metrics = SWISS_SHEET;
  const { padding, heading, footer, cardWidth, cardHeight, columnGap, rowGap } =
    metrics;
  const matches = new Map(bracket.matches.map((match) => [match.id, match]));
  const byIteration = new Map<number, SwissRecordGroup[]>();
  for (const group of bracket.swiss?.groups ?? []) {
    const entries = group.entries.filter((entry) => matches.has(entry.matchId));
    if (!entries.length) continue;
    const iteration = byIteration.get(group.bracketRound) ?? [];
    iteration.push({ ...group, entries });
    byIteration.set(group.bracketRound, iteration);
  }
  const resultMap = new Map<
    string,
    Omit<SwissResultGroup, "x" | "y" | "height">
  >();
  if (standings?.format === "SWISS") {
    const qualified = new Set(
      standings.advancement.qualifiedTeams.map(
        (assignment) => assignment.team.id,
      ),
    );
    for (const row of [...standings.standings].sort(
      (a, b) => a.rank - b.rank,
    )) {
      const isQualified = qualified.has(row.teamId);
      const key = `${row.wins}-${row.losses}-${isQualified}`;
      const group = resultMap.get(key) ?? {
        key,
        wins: row.wins,
        losses: row.losses,
        qualified: isQualified,
        teams: [],
      };
      group.teams.push(row);
      resultMap.set(key, group);
    }
  }
  const groupHeight = (group: SwissRecordGroup) =>
    heading + group.entries.length * cardHeight + footer;
  const resultHeight = (teamCount: number) =>
    heading + Math.max(56, Math.ceil(teamCount / 3) * 34 + 16);
  const resultsHeight =
    [...resultMap.values()].reduce(
      (height, group) => height + resultHeight(group.teams.length),
      0,
    ) +
    Math.max(0, resultMap.size - 1) * rowGap;
  const contentHeight = Math.max(
    280,
    ...[...byIteration.values()].map(
      (groups) =>
        groups.reduce((height, group) => height + groupHeight(group), 0) +
        (groups.length - 1) * rowGap,
    ),
    resultsHeight,
  );
  const groups: PositionedSwissGroup[] = [];
  const columns: BracketLayout["columns"] = [];
  const nodes: BracketLayout["nodes"] = [];
  const lastIteration = Math.max(0, ...byIteration.keys());
  const totalIterations = lastIteration
    ? Math.max(lastIteration, numberOfRounds ?? lastIteration)
    : 0;
  for (let iteration = 1; iteration <= totalIterations; iteration++) {
    const columnGroups = [...(byIteration.get(iteration) ?? [])].sort(
      (a, b) =>
        (b.records[0]?.wins ?? -1) - (a.records[0]?.wins ?? -1) ||
        (a.records[0]?.losses ?? 0) - (b.records[0]?.losses ?? 0) ||
        a.id.localeCompare(b.id),
    );
    const x = padding + (iteration - 1) * (cardWidth + columnGap);
    columns.push({
      key: `swiss-column-${iteration}`,
      lane: "main",
      round: iteration,
      x,
      y: padding,
      kind: "round",
      pending: !columnGroups.length,
    });
    const totalHeight =
      columnGroups.reduce((height, group) => height + groupHeight(group), 0) +
      Math.max(0, columnGroups.length - 1) * rowGap;
    let y = padding + heading + (contentHeight - totalHeight) / 2;
    for (const group of columnGroups) {
      const height = groupHeight(group);
      groups.push({ group, x, y, height });
      group.entries.forEach((entry, index) =>
        nodes.push({
          match: matches.get(entry.matchId)!,
          x,
          y: y + heading + index * cardHeight,
          lane: "main",
        }),
      );
      y += height + rowGap;
    }
  }
  const positioned = new Map(groups.map((group) => [group.group.id, group]));
  const edges: BracketLayout["edges"] = [];
  for (const link of bracket.swiss?.links ?? []) {
    const from = positioned.get(link.from);
    const to = positioned.get(link.to);
    if (!from || !to || from.x >= to.x) continue;
    const x1 = from.x + cardWidth;
    const x2 = to.x;
    const y1 = from.y + heading + (from.height - heading - footer) / 2;
    const y2 = to.y + heading + (to.height - heading - footer) / 2;
    edges.push({
      from: link.from,
      to: link.to,
      result: link.result,
      slot: link.result === "winner" ? "A" : "B",
      path: `M ${x1} ${y1} H ${x1 + columnGap / 2 + (link.result === "loser" ? 5 : -5)} V ${y2} H ${x2}`,
    });
  }
  let resultY = padding + heading + (contentHeight - resultsHeight) / 2;
  const results = [...resultMap.values()].map((group) => {
    const height = resultHeight(group.teams.length);
    const positioned = {
      ...group,
      x: padding + totalIterations * (cardWidth + columnGap),
      y: resultY,
      height,
    };
    resultY += height + rowGap;
    return positioned;
  });
  const columnCount = totalIterations + Number(results.length > 0);
  return {
    metrics,
    groups,
    results,
    nodes,
    columns,
    lanes: [],
    edges,
    width: Math.max(
      640,
      padding * 2 +
        columnCount * cardWidth +
        Math.max(0, columnCount - 1) * columnGap,
    ),
    height: padding * 2 + heading + contentHeight,
  };
}
