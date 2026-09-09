import assert from "node:assert/strict";
import test from "node:test";
import { layoutSwissBracket } from "../features/tournaments/components/competition/bracket/swiss-presentation.ts";
import { swiss, teams } from "./fixtures/brackets.mjs";

test("Swiss groups preserve every fixture and API link without overlaps", () => {
  const bracket = swiss();
  const before = structuredClone(bracket);
  const layout = layoutSwissBracket(bracket, undefined, 3);
  assert.equal(layout.nodes.length, bracket.matches.length);
  assert.equal(layout.groups.length, 3);
  assert.equal(layout.edges.length, bracket.swiss.links.length);
  assert.deepEqual(
    layout.columns
      .filter((column) => column.pending)
      .map((column) => column.round),
    [3],
  );
  assert.equal(
    layout.groups.filter((group) => group.group.bracketRound === 3).length,
    0,
  );
  for (const box of layout.groups) {
    assert.ok(box.x >= 0 && box.y >= 0);
    assert.ok(box.x + layout.metrics.cardWidth <= layout.width);
    assert.ok(box.y + box.height <= layout.height);
    for (const other of layout.groups) {
      if (box === other) continue;
      assert.ok(
        box.x !== other.x ||
          box.y + box.height <= other.y ||
          other.y + other.height <= box.y,
      );
    }
  }
  assert.deepEqual(bracket, before);
});

test("display uses API records without reconstructing scores or inferring qualification", () => {
  const bracket = swiss();
  for (const match of bracket.matches) match.score = { A: 99, B: 0 };
  const standings = {
    format: "SWISS",
    advancement: { qualifiedTeams: [] },
    standings: [
      { rank: 1, teamId: teams[0].id, team: teams[0], wins: 3, losses: 0 },
      { rank: 2, teamId: teams[1].id, team: teams[1], wins: 3, losses: 0 },
    ],
  };
  const layout = layoutSwissBracket(bracket, standings, 3);
  assert.deepEqual(layout.groups[0].group.records, [{ wins: 0, losses: 0 }]);
  assert.equal(layout.results.length, 1);
  assert.equal(layout.results[0].qualified, false);
  standings.advancement.qualifiedTeams = [{ team: teams[1] }];
  const confirmed = layoutSwissBracket(bracket, standings, 3);
  assert.deepEqual(
    confirmed.results
      .filter((group) => group.qualified)
      .flatMap((group) => group.teams.map((team) => team.teamId)),
    [teams[1].id],
  );
});

test("mixed records stay labeled and unknown match IDs never invent fixtures", () => {
  const bracket = swiss();
  bracket.swiss.groups[1].records = [
    { wins: 1, losses: 0 },
    { wins: 0, losses: 1 },
  ];
  bracket.swiss.groups[1].entries.push({ matchId: "absent", A: null, B: null });
  const layout = layoutSwissBracket(bracket);
  assert.equal(layout.nodes.length, bracket.matches.length);
  assert.equal(
    layout.groups.find((group) => group.group.id === "swiss-2-1-0").group
      .records.length,
    2,
  );
  assert.equal(
    layout.nodes.some((node) => node.match.id === "absent"),
    false,
  );
});

test("large result groups fit all teams inside the sheet", () => {
  const standings = {
    format: "SWISS",
    advancement: { qualifiedTeams: [] },
    standings: Array.from({ length: 32 }, (_, index) => ({
      rank: index + 1,
      teamId: `team-${index}`,
      team: teams[index % 8],
      wins: 1,
      losses: 1,
    })),
  };
  const layout = layoutSwissBracket(swiss(), standings, 3);
  assert.ok(layout.results[0].height > 350);
  assert.ok(layout.results[0].y + layout.results[0].height <= layout.height);
  assert.ok(layout.results[0].x + layout.metrics.cardWidth <= layout.width);
});

test("threshold result panels follow backend state before advancement is persisted", () => {
  const bracket = swiss();
  const layout = layoutSwissBracket(bracket, {
    format: "SWISS", advancement: { qualifiedTeams: [] },
    standings: [
      { rank: 1, teamId: "q", team: teams[0], wins: 3, losses: 0, state: "QUALIFIED" },
      { rank: 2, teamId: "a", team: teams[1], wins: 2, losses: 2, state: "ACTIVE" },
      { rank: 3, teamId: "e", team: teams[2], wins: 0, losses: 3, state: "ELIMINATED" },
    ],
  }, 5);
  assert.equal(layout.results.find(group => group.teams[0].teamId === "q").qualified, true);
  assert.equal(layout.results.find(group => group.teams[0].teamId === "e").eliminated, true);
  assert.equal(layout.results.find(group => group.teams[0].teamId === "a").qualified, false);
});
