import assert from "node:assert/strict";
import test from "node:test";
import {
  dispatchTournamentRealtimeEvent,
  isTournamentRealtimeEnvelope,
} from "../features/realtime/types.ts";

test("realtime events are delivered only to listeners for their tournament", () => {
  const receivedByFirst = [];
  const receivedBySecond = [];
  const listeners = new Map([
    [
      "tournament-1",
      new Set([(event, payload) => receivedByFirst.push({ event, payload })]),
    ],
    [
      "tournament-2",
      new Set([(event, payload) => receivedBySecond.push({ event, payload })]),
    ],
  ]);

  const delivered = dispatchTournamentRealtimeEvent(
    "matchUpdated",
    { tournamentId: "tournament-1", data: { matchId: "match-1" } },
    listeners,
  );

  assert.equal(delivered, true);
  assert.deepEqual(receivedByFirst, [
    { event: "matchUpdated", payload: { matchId: "match-1" } },
  ]);
  assert.deepEqual(receivedBySecond, []);
});

test("realtime routing ignores tournaments without subscribers", () => {
  const delivered = dispatchTournamentRealtimeEvent(
    "standingsUpdated",
    { tournamentId: "unobserved", data: { matchId: "match-1" } },
    new Map(),
  );

  assert.equal(delivered, false);
});

test("realtime envelopes require an explicit tournament and data field", () => {
  assert.equal(
    isTournamentRealtimeEnvelope({ tournamentId: "tournament-1", data: null }),
    true,
  );
  assert.equal(isTournamentRealtimeEnvelope({ tournamentId: "" }), false);
  assert.equal(
    isTournamentRealtimeEnvelope({ tournamentId: "tournament-1" }),
    false,
  );
  assert.equal(isTournamentRealtimeEnvelope(null), false);
});
