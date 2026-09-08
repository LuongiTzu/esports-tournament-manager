import assert from "node:assert/strict";
import test from "node:test";
import {
  BRACKET,
  getMatchSources,
  isThirdPlace,
  layoutBracket,
  matchCode,
  matchScore,
  sourceLabel,
} from "../features/tournaments/components/competition/bracket/bracket-presentation.ts";
import {
  doubleElimination,
  match,
  playoff,
  swiss,
  teams,
} from "./fixtures/brackets.mjs";

test("incoming placeholders respect the API's destination slot, including reversed loser slots", () => {
  const sources = getMatchSources(doubleElimination().matches);
  assert.equal(sources.get("l1").A.match.id, "w2");
  assert.equal(sources.get("l1").B.match.id, "w1");
  assert.equal(sources.get("lf").A.result, "winner");
  assert.equal(sources.get("lf").B.result, "loser");
  assert.equal(sources.get("reset").A.match.id, "gf");
  assert.equal(sources.get("reset").B.result, "loser");
});

test("unknown destinations do not create participants or matches", () => {
  const orphan = match("orphan", { nextMatch: { id: "absent", slot: "A" } });
  assert.equal(getMatchSources([orphan]).size, 0);
  assert.equal(
    sourceLabel(undefined, (key) => key),
    "match.awaitingTeam",
  );
});

test("codes distinguish rounds and branches when match numbers repeat", () => {
  const bracket = doubleElimination();
  const codes = bracket.matches.map(matchCode);
  assert.equal(new Set(codes).size, codes.length);
});

for (const size of [2, 4, 8, 16, 32])
  test(`${size}-team playoff: no overlapping cards, no invented nodes, every link targets a slot`, () => {
    const bracket = playoff(size, size >= 4);
    const before = structuredClone(bracket);
    const layout = layoutBracket(bracket);
    assert.equal(layout.nodes.length, bracket.matches.length);
    assert.equal(
      layout.edges.length,
      bracket.matches.reduce(
        (count, item) =>
          count +
          Number(Boolean(item.nextMatch.id)) +
          Number(Boolean(item.loserNextMatch.id)),
        0,
      ),
    );
    for (const node of layout.nodes) {
      assert.ok(node.x >= 0 && node.y >= 0);
      assert.ok(node.x + BRACKET.cardWidth <= layout.width);
      assert.ok(node.y + BRACKET.cardHeight <= layout.height);
      for (const other of layout.nodes) {
        if (node === other) continue;
        assert.ok(
          node.x + BRACKET.cardWidth <= other.x ||
            other.x + BRACKET.cardWidth <= node.x ||
            node.y + BRACKET.cardHeight <= other.y ||
            other.y + BRACKET.cardHeight <= node.y,
          `${node.match.id} overlaps ${other.match.id}`,
        );
      }
    }
    assert.deepEqual(bracket, before);
    assert.deepEqual(
      layoutBracket({ ...bracket, matches: [...bracket.matches].reverse() }),
      layout,
    );
  });

test("double elimination keeps all winner/loser routes and the inactive reset", () => {
  for (const enabled of [true, false]) {
    const bracket = doubleElimination(enabled);
    const layout = layoutBracket(bracket);
    assert.equal(
      layout.nodes.some((node) => node.match.id === "reset"),
      enabled,
    );
    assert.equal(layout.edges.length, enabled ? 10 : 8);
    const { cardWidth, cardHeight } = layout.metrics;
    for (const node of layout.nodes) {
      assert.ok(node.x + cardWidth <= layout.width);
      assert.ok(node.y + cardHeight <= layout.height);
      for (const other of layout.nodes) {
        if (node === other) continue;
        assert.ok(
          node.x + cardWidth <= other.x ||
            other.x + cardWidth <= node.x ||
            node.y + cardHeight <= other.y ||
            other.y + cardHeight <= node.y,
          `${node.match.id} overlaps ${other.match.id}`,
        );
      }
    }
    for (const edge of layout.edges) {
      const from = layout.nodes.find((node) => node.match.id === edge.from);
      const to = layout.nodes.find((node) => node.match.id === edge.to);
      if (
        edge.result === "loser" &&
        from.lane === "WINNER" &&
        to.lane === "LOSER"
      ) {
        assert.ok(to.x >= from.x && to.y > from.y);
      } else {
        assert.ok(to.x > from.x);
      }
      assert.ok(!edge.path.includes("NaN"));
    }
  }
});

test("bronze and BYE remain distinct from an unknown opponent", () => {
  const bracket = playoff(4, true);
  assert.equal(
    isThirdPlace(
      bracket.matches.find((item) => item.id === "bronze"),
      bracket,
    ),
    true,
  );
  bracket.matches[0].isBye = true;
  bracket.matches[0].slots.B = null;
  const layout = layoutBracket(bracket);
  assert.ok(layout.nodes.find((node) => node.match.id === "p-1-1").match.isBye);
  assert.equal(layout.edges.length, 4);
  assert.equal(
    getMatchSources(bracket.matches).get("bronze").A.result,
    "loser",
  );
});

test("Swiss future columns use resolved progress and never invent fixtures or progression edges", () => {
  const bracket = swiss();
  const layout = layoutBracket(bracket, 5);
  assert.equal(layout.nodes.length, bracket.matches.length);
  assert.deepEqual(
    layout.columns
      .filter((column) => column.pending)
      .map((column) => column.round),
    [3, 4, 5],
  );
  assert.deepEqual(layout.edges, []);
  assert.equal(layoutBracket(bracket).columns.length, 2);
  assert.equal(layoutBracket({ ...bracket, matches: [] }, 5).columns.length, 0);
});

test("score display preserves zero in a live match but leaves pending, BYE and inactive scores blank", () => {
  const fixture = match("score", { slots: { A: teams[0], B: teams[1] } });
  assert.equal(matchScore(fixture, "A"), "—");
  fixture.status = "ONGOING";
  assert.equal(matchScore(fixture, "A"), "0");
  fixture.isActive = false;
  assert.equal(matchScore(fixture, "A"), "—");
  fixture.isActive = true;
  fixture.isBye = true;
  assert.equal(matchScore(fixture, "A"), "—");
});

test("round-robin keeps every scheduled meeting in its API round, with no progression edges", () => {
  const bracket = swiss();
  bracket.round.format = "ROUND_ROBIN";
  bracket.round.settings = {
    meetingsPerPair: 2,
    allowDraws: true,
    advancingTeamCount: 2,
    winPoints: 3,
    drawPoints: 1,
    lossPoints: 0,
  };
  const layout = layoutBracket(bracket);
  assert.equal(layout.nodes.length, 8);
  assert.equal(layout.columns.length, 2);
  assert.deepEqual(layout.edges, []);
});

test("group stage uses group order and keeps separate lanes even when match numbers repeat", () => {
  const bracket = swiss();
  bracket.round.format = "GROUP_STAGE";
  bracket.groups = [
    { id: "b", name: "Bảng B", orderIndex: 2, teams: [] },
    { id: "a", name: "Bảng A", orderIndex: 1, teams: [] },
  ];
  bracket.matches = [
    match("a1", { groupId: "a" }),
    match("b1", { groupId: "b" }),
    match("a2", { groupId: "a", bracketRound: 2 }),
    match("b2", { groupId: "b", bracketRound: 2 }),
  ];
  const layout = layoutBracket(bracket);
  assert.deepEqual(
    layout.lanes.map((lane) => lane.groupName),
    ["Bảng A", "Bảng B"],
  );
  assert.equal(layout.columns.length, 4);
  assert.ok(
    layout.nodes.find((node) => node.match.id === "b1").y >
      layout.nodes.find((node) => node.match.id === "a1").y +
        BRACKET.cardHeight,
  );
  assert.deepEqual(layout.edges, []);
});
