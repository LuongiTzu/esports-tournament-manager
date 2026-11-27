import assert from "node:assert/strict";
import test from "node:test";
import {
  joinActiveTournamentRooms,
  subscribeTournamentRoom,
} from "../features/realtime/room-subscriptions.ts";

function socket(connected = true) {
  const emissions = [];
  return {
    connected,
    emissions,
    emit(event, payload) {
      emissions.push({ event, payload });
    },
  };
}

test("only the first tournament subscriber joins and only the last one leaves", () => {
  const listeners = new Map();
  const connectedSocket = socket();
  const socketRef = { current: connectedSocket };
  const first = subscribeTournamentRoom(listeners, socketRef, "t-1", () => {});
  const second = subscribeTournamentRoom(listeners, socketRef, "t-1", () => {});

  assert.deepEqual(connectedSocket.emissions, [
    { event: "joinTournament", payload: { tournamentId: "t-1" } },
  ]);
  first();
  assert.equal(listeners.get("t-1").size, 1);
  assert.equal(connectedSocket.emissions.length, 1);
  second();
  assert.equal(listeners.has("t-1"), false);
  assert.deepEqual(connectedSocket.emissions[1], {
    event: "leaveTournament",
    payload: { tournamentId: "t-1" },
  });
});

test("offline subscriptions join on reconnect and do not emit leave while offline", () => {
  const listeners = new Map();
  const offlineSocket = socket(false);
  const socketRef = { current: offlineSocket };
  const unsubscribe = subscribeTournamentRoom(
    listeners,
    socketRef,
    "t-1",
    () => {},
  );
  assert.deepEqual(offlineSocket.emissions, []);

  const reconnectedSocket = socket();
  socketRef.current = reconnectedSocket;
  joinActiveTournamentRooms(reconnectedSocket, listeners);
  assert.deepEqual(reconnectedSocket.emissions, [
    { event: "joinTournament", payload: { tournamentId: "t-1" } },
  ]);

  reconnectedSocket.connected = false;
  unsubscribe();
  assert.equal(listeners.size, 0);
  assert.equal(reconnectedSocket.emissions.length, 1);
});

test("reconnect joins only tournaments that still have subscribers", () => {
  const listeners = new Map();
  const socketRef = { current: null };
  subscribeTournamentRoom(listeners, socketRef, "t-1", () => {});
  const removeSecond = subscribeTournamentRoom(
    listeners,
    socketRef,
    "t-2",
    () => {},
  );
  removeSecond();

  const reconnectedSocket = socket();
  joinActiveTournamentRooms(reconnectedSocket, listeners);
  assert.deepEqual(reconnectedSocket.emissions, [
    { event: "joinTournament", payload: { tournamentId: "t-1" } },
  ]);
});
