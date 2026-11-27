import assert from "node:assert/strict";
import test from "node:test";
import {
  parseChampionshipTieBreakDetails,
  parseQualificationTieBreakDetails,
} from "../features/tournaments/components/manage/competition-manager-errors.ts";

const team = (id) => ({ teamId: id, name: `Team ${id}`, seed: null });

test("qualification tie details retain fixed teams and the tie band for user selection", () => {
  const details = {
    advanceCount: 2,
    fixedQualifiedTeams: [team("a")],
    tieBreaks: [
      {
        scope: "ROUND",
        groupId: null,
        groupName: null,
        requiredSelections: 1,
        candidates: [team("b"), team("c")],
      },
    ],
  };
  assert.deepEqual(parseQualificationTieBreakDetails(details), details);
});

test("malformed qualification tie details do not reach the decision UI", () => {
  const base = {
    advanceCount: 2,
    fixedQualifiedTeams: [team("a")],
    tieBreaks: [
      {
        scope: "ROUND",
        groupId: null,
        groupName: null,
        requiredSelections: 1,
        candidates: [team("b"), team("c")],
      },
    ],
  };
  for (const value of [
    undefined,
    { ...base, advanceCount: 1.5 },
    { ...base, fixedQualifiedTeams: [{ teamId: "a" }] },
    { ...base, tieBreaks: [] },
    { ...base, tieBreaks: [{ ...base.tieBreaks[0], requiredSelections: 0 }] },
    { ...base, tieBreaks: [{ ...base.tieBreaks[0], candidates: [null] }] },
  ]) {
    assert.equal(parseQualificationTieBreakDetails(value), null);
  }
});

test("championship selection requires at least two valid candidates", () => {
  assert.deepEqual(
    parseChampionshipTieBreakDetails({ candidates: [team("a"), team("b")] }),
    {
      candidates: [team("a"), team("b")],
    },
  );
  assert.equal(
    parseChampionshipTieBreakDetails({ candidates: [team("a")] }),
    null,
  );
  assert.equal(
    parseChampionshipTieBreakDetails({ candidates: [team("a"), null] }),
    null,
  );
});
