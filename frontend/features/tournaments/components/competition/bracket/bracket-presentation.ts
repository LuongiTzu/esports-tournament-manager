import type { TranslationKey } from "@/features/locale/store";
import type { BracketMatch, RoundBracket } from "@/features/tournaments/types";

export type Translate = (key: TranslationKey) => string;
export type Slot = "A" | "B";
export interface MatchSource {
  match: BracketMatch;
  result: "winner" | "loser";
}
export type MatchSources = Partial<Record<Slot, MatchSource>>;

/** Reverse the API's routing links for display; never resolve participants locally. */
export function getMatchSources(matches: BracketMatch[]) {
  const ids = new Set(matches.map((match) => match.id));
  const sources = new Map<string, MatchSources>();
  for (const match of matches) {
    for (const result of ["winner", "loser"] as const) {
      const route =
        result === "winner" ? match.nextMatch : match.loserNextMatch;
      if (!route.id || !route.slot || !ids.has(route.id)) continue;
      const slots = sources.get(route.id) ?? {};
      slots[route.slot] = { match, result };
      sources.set(route.id, slots);
    }
  }
  return sources;
}

export function matchCode(match: BracketMatch) {
  const branch =
    match.bracketType === "WINNER"
      ? "WB-"
      : match.bracketType === "LOSER"
        ? "LB-"
        : "";
  return `${branch}R${match.bracketRound ?? "?"}-M${match.matchNumber ?? "?"}`;
}

export function sourceLabel(
  source: MatchSource | undefined,
  t: Translate,
  numbers?: ReadonlyMap<string, number>,
) {
  return source
    ? `${t(source.result === "winner" ? "bracket.winnerOf" : "bracket.loserOf")} ${numbers?.has(source.match.id) ? `M${numbers.get(source.match.id)}` : matchCode(source.match)}`
    : t("match.awaitingTeam");
}

export function isThirdPlace(match: BracketMatch, bracket: RoundBracket) {
  // The persisted PLAYOFF contract reserves match 2 of the last round for bronze.
  return (
    bracket.round.format === "PLAYOFF" &&
    bracket.round.settings.thirdPlaceMatch &&
    match.matchNumber === 2 &&
    match.bracketRound ===
      Math.max(...bracket.matches.map((item) => item.bracketRound ?? 0))
  );
}

export function matchHeading(
  match: BracketMatch,
  bracket: RoundBracket,
  t: Translate,
) {
  if (match.activationCondition) return t("bracket.resetFinal");
  if (isThirdPlace(match, bracket)) return t("competition.thirdPlace");
  if (bracket.round.format === "DOUBLE_ELIM" && match.bracketType === null)
    return t("competition.grandFinal");
  if (
    bracket.round.format === "PLAYOFF" &&
    match.nextMatch.id === null &&
    !isThirdPlace(match, bracket)
  )
    return t("competition.final");
  return matchCode(match);
}

export function matchScore(match: BracketMatch, slot: Slot) {
  return match.slots[slot] &&
    match.isActive &&
    !match.isBye &&
    match.status !== "PENDING"
    ? String(match.score[slot])
    : "—";
}

export const BRACKET = {
  cardWidth: 320,
  cardHeight: 80,
  columnGap: 76,
  rowGap: 14,
  padding: 42,
  heading: 40,
  sourceY: 26,
  slotAY: 26,
  slotBY: 26,
} as const;

export function bracketMetrics(format: RoundBracket["round"]["format"]) {
  return format === "DOUBLE_ELIM"
    ? {
        cardWidth: 288,
        cardHeight: 128,
        columnGap: 92,
        rowGap: 62,
        padding: 44,
        heading: 48,
        sourceY: 68,
        slotAY: 68,
        slotBY: 68,
      }
    : BRACKET;
}
export interface PositionedMatch {
  match: BracketMatch;
  x: number;
  y: number;
  lane: string;
}
export interface BracketColumn {
  key: string;
  lane: string;
  round: number;
  x: number;
  y: number;
  kind: "round" | "final" | "reset" | "bronze";
  pending?: boolean;
}
export interface BracketLane {
  key: string;
  y: number;
  groupName?: string;
}
export interface BracketEdge {
  from: string;
  to: string;
  slot: Slot;
  result: "winner" | "loser";
  path: string;
}
export interface BracketLayout {
  metrics: ReturnType<typeof bracketMetrics>;
  width: number;
  height: number;
  nodes: PositionedMatch[];
  columns: BracketColumn[];
  lanes: BracketLane[];
  edges: BracketEdge[];
}

/** Position existing matches only. Edges come exclusively from API IDs and slots. */
export function layoutBracket(
  bracket: RoundBracket,
  swissRounds?: number,
): BracketLayout {
  const metrics = bracketMetrics(bracket.round.format);
  const { cardWidth, cardHeight, columnGap, rowGap, padding, heading } =
    metrics;
  const elimination = ["PLAYOFF", "DOUBLE_ELIM"].includes(bracket.round.format);
  const sources = getMatchSources(bracket.matches);
  const laneFor = (match: BracketMatch) => {
    if (isThirdPlace(match, bracket)) return "bronze";
    if (bracket.round.format === "DOUBLE_ELIM")
      return match.bracketType ?? "final";
    if (bracket.round.format === "GROUP_STAGE")
      return match.groupId ?? "ungrouped";
    return "main";
  };
  const laneOrder =
    bracket.round.format === "DOUBLE_ELIM"
      ? ["WINNER", "LOSER", "final"]
      : bracket.round.format === "GROUP_STAGE"
        ? [...bracket.groups]
            .sort((a, b) => a.orderIndex - b.orderIndex)
            .map((group) => group.id)
        : ["main", "bronze"];
  const sorted = [...bracket.matches].sort(
    (a, b) =>
      laneOrder.indexOf(laneFor(a)) - laneOrder.indexOf(laneFor(b)) ||
      (a.bracketRound ?? 0) - (b.bracketRound ?? 0) ||
      (a.matchNumber ?? 0) - (b.matchNumber ?? 0) ||
      a.id.localeCompare(b.id),
  );
  const bucketKey = (match: BracketMatch) =>
    `${laneFor(match)}:${match.bracketRound ?? 0}`;
  const buckets = new Map<string, BracketMatch[]>();
  for (const match of sorted) {
    const key = bucketKey(match);
    buckets.set(key, [...(buckets.get(key) ?? []), match]);
  }
  // Columns follow the dependency graph, including winner-to-loser transfers.
  const columnIndex = new Map<string, number>();
  const visiting = new Set<string>();
  function columnFor(key: string): number {
    const cached = columnIndex.get(key);
    if (cached !== undefined) return cached;
    if (visiting.has(key)) return 0;
    visiting.add(key);
    const matches = buckets.get(key) ?? [];
    const first = matches[0];
    let column = Math.max(0, (first?.bracketRound ?? 1) - 1);
    if (elimination) {
      column = 0;
      for (const match of matches) {
        for (const source of Object.values(sources.get(match.id) ?? {})) {
          const sourceKey = bucketKey(source.match);
          if (sourceKey !== key) {
            // A drop to the lower bracket can share its source's column.
            const drop =
              source.result === "loser" &&
              laneFor(source.match) === "WINNER" &&
              laneFor(match) === "LOSER";
            column = Math.max(column, columnFor(sourceKey) + (drop ? 0 : 1));
          }
        }
      }
      // Keep disconnected/BYE matches in the same ordered round columns.
      const previous = [...buckets.keys()]
        .filter(
          (other) =>
            other !== key &&
            buckets.get(other)?.[0] &&
            laneFor(buckets.get(other)![0]) === laneFor(first) &&
            (buckets.get(other)![0].bracketRound ?? 0) <
              (first.bracketRound ?? 0),
        )
        .at(-1);
      if (previous) column = Math.max(column, columnFor(previous) + 1);
    }
    visiting.delete(key);
    columnIndex.set(key, column);
    return column;
  }
  for (const key of buckets.keys()) columnFor(key);

  const nodes: PositionedMatch[] = [];
  const columns: BracketColumn[] = [];
  const lanes: BracketLane[] = [];
  const positioned = new Map<string, PositionedMatch>();
  const activeLanes = [...new Set(sorted.map(laneFor))];
  let laneTop = padding;
  let lowerGutter = 0;
  for (const lane of activeLanes) {
    // Finals share the right of the two lanes rather than creating a third row.
    const finalLane = lane === "final";
    const playoffFinal =
      lane === "bronze"
        ? nodes.find(
            (node) => node.lane === "main" && node.match.nextMatch.id === null,
          )
        : undefined;
    const top = finalLane
      ? padding
      : playoffFinal
        ? playoffFinal.y + cardHeight + rowGap
        : laneTop;
    lanes.push({
      key: lane,
      y: top,
      groupName: bracket.groups.find((group) => group.id === lane)?.name,
    });
    let laneBottom = top + heading;
    for (const [key, matches] of buckets) {
      if (laneFor(matches[0]) !== lane) continue;
      const x = padding + columnFor(key) * (cardWidth + columnGap);
      columns.push({
        key,
        lane,
        round: matches[0].bracketRound ?? 0,
        x,
        y: top + 26,
        kind:
          lane === "bronze"
            ? "bronze"
            : matches[0].activationCondition
              ? "reset"
              : finalLane
                ? "final"
                : "round",
      });
      let bottom = top + heading - rowGap;
      let previousMatch: BracketMatch | undefined;
      for (const match of matches) {
        const parents = elimination
          ? Object.values(sources.get(match.id) ?? {})
              .map((source) => positioned.get(source.match.id))
              .filter((node): node is PositionedMatch =>
                Boolean(node && (finalLane || node.lane === lane)),
              )
          : [];
        const upperFinal =
          finalLane && parents.find((node) => node.lane === "WINNER");
        const desired = upperFinal
          ? upperFinal.y
          : parents.length
            ? parents.reduce((sum, node) => sum + node.y, 0) / parents.length
            : top + heading;
        const pairGap =
          bracket.round.format === "PLAYOFF" &&
          previousMatch &&
          previousMatch.nextMatch.id !== match.nextMatch.id
            ? rowGap + 34
            : rowGap;
        const y = Math.max(top + heading, bottom + pairGap, desired);
        const node = { match, x, y, lane };
        nodes.push(node);
        positioned.set(match.id, node);
        bottom = y + cardHeight;
        previousMatch = match;
        laneBottom = Math.max(laneBottom, bottom);
      }
    }
    if (!finalLane && !playoffFinal) {
      lowerGutter = lane === "WINNER" ? laneBottom + 36 : lowerGutter;
      laneTop = laneBottom + 140;
    }
  }
  if (bracket.round.format === "SWISS" && sorted.length && swissRounds) {
    const last = Math.max(...sorted.map((match) => match.bracketRound ?? 0));
    for (let round = last + 1; round <= swissRounds; round++) {
      columns.push({
        key: `pending-${round}`,
        lane: "main",
        round,
        x: padding + (round - 1) * (cardWidth + columnGap),
        y: padding + 26,
        kind: "round",
        pending: true,
      });
    }
  }
  const edges: BracketEdge[] = [];
  if (elimination)
    for (const node of nodes) {
      for (const slot of ["A", "B"] as const) {
        const source = sources.get(node.match.id)?.[slot];
        const from = source && positioned.get(source.match.id);
        if (!source || !from) continue;
        const crossLane = from.lane === "WINNER" && node.lane === "LOSER";
        if (from.x >= node.x && !crossLane) continue;
        const x1 = from.x + cardWidth;
        const y1 = from.y + metrics.sourceY;
        const x2 = node.x;
        const y2 = node.y + (slot === "A" ? metrics.slotAY : metrics.slotBY);
        const path = crossLane
          ? from.x === node.x
            ? `M ${from.x} ${y1} H ${from.x - 16 - (slot === "B" ? 8 : 0)} V ${y2} H ${x2}`
            : `M ${x1} ${y1} H ${x1 + 24} V ${lowerGutter + (edges.length % 8) * 6} H ${x2 - 24} V ${y2} H ${x2}`
          : `M ${x1} ${y1} H ${x2 - columnGap / 2} V ${y2} H ${x2}`;
        edges.push({
          from: from.match.id,
          to: node.match.id,
          slot,
          result: source.result,
          path,
        });
      }
    }
  return {
    metrics,
    nodes,
    columns,
    lanes,
    edges,
    width: Math.max(
      640,
      ...columns.map((column) => column.x + cardWidth + padding),
    ),
    height: Math.max(
      320,
      ...nodes.map((node) => node.y + cardHeight + padding),
    ),
  };
}
