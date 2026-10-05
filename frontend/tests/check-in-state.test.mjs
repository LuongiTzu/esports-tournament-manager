import assert from "node:assert/strict";
import test from "node:test";
import {
  getMyCheckInState,
  pickPriorityMatch,
} from "../features/matches/check-in-state.ts";

const scheduledAt = "2030-06-15T20:00:00.000Z";
const match = (patch = {}) => ({
  id: "match-a",
  scheduledAt,
  status: "PENDING",
  userTeamIds: ["team-a"],
  captainTeamIds: ["team-a"],
  checkIns: [],
  checkInWindow: {
    opensAt: "2030-06-15T19:30:00.000Z",
    closesAt: scheduledAt,
  },
  ...patch,
});

test("check-in changes at the backend-provided opening and closing instants", () => {
  assert.equal(
    getMyCheckInState(match(), Date.parse("2030-06-15T19:29:59.999Z")).state,
    "OPENS_LATER",
  );
  assert.equal(
    getMyCheckInState(match(), Date.parse("2030-06-15T19:30:00.000Z")).state,
    "OPEN",
  );
  assert.equal(
    getMyCheckInState(match(), Date.parse(scheduledAt)).state,
    "OPEN",
  );
  assert.equal(
    getMyCheckInState(match(), Date.parse("2030-06-15T20:00:00.001Z")).state,
    "MISSED",
  );
});

test("a recorded check-in remains complete after the window closes", () => {
  const checked = match({ checkIns: [{ teamId: "team-a" }] });
  assert.equal(
    getMyCheckInState(checked, Date.parse("2030-06-15T21:00:00Z")).state,
    "CHECKED_IN",
  );
});

test("members can see their team state without gaining captain permission", () => {
  assert.deepEqual(
    getMyCheckInState(
      match({ captainTeamIds: [] }),
      Date.parse("2030-06-15T19:45:00Z"),
    ),
    {
      state: "OPEN",
      teamId: "team-a",
      canCheckIn: false,
    },
  );
});

test("unscheduled and non-pending matches do not appear overdue", () => {
  assert.equal(
    getMyCheckInState(match({ checkInWindow: null }), Date.parse(scheduledAt))
      .state,
    "UNSCHEDULED",
  );
  assert.equal(
    getMyCheckInState(match({ status: "ONGOING" }), Date.parse(scheduledAt)),
    null,
  );
});

test("open check-in outranks overdue and future matches", () => {
  const overdue = match({
    id: "overdue",
    scheduledAt: "2030-06-15T19:00:00Z",
    checkInWindow: {
      opensAt: "2030-06-15T18:30:00Z",
      closesAt: "2030-06-15T19:00:00Z",
    },
  });
  const open = match({ id: "open" });
  const future = match({
    id: "future",
    scheduledAt: "2030-06-15T22:00:00Z",
    checkInWindow: {
      opensAt: "2030-06-15T21:30:00Z",
      closesAt: "2030-06-15T22:00:00Z",
    },
  });
  assert.equal(
    pickPriorityMatch(
      [future, overdue, open],
      Date.parse("2030-06-15T19:45:00Z"),
    ).id,
    "open",
  );
  assert.equal(
    pickPriorityMatch([future, overdue], Date.parse("2030-06-15T19:45:00Z")).id,
    "overdue",
  );
});
