import type { TournamentRealtimeListener } from "./types";

type TournamentRoomSocket = {
  connected: boolean;
  emit(
    event: "joinTournament" | "leaveTournament",
    payload: { tournamentId: string },
  ): void;
};

export type TournamentListeners = Map<string, Set<TournamentRealtimeListener>>;

export function joinActiveTournamentRooms(
  socket: TournamentRoomSocket,
  listenersByTournament: TournamentListeners,
) {
  listenersByTournament.forEach((_listeners, tournamentId) => {
    socket.emit("joinTournament", { tournamentId });
  });
}

export function subscribeTournamentRoom(
  listenersByTournament: TournamentListeners,
  socketRef: { current: TournamentRoomSocket | null },
  tournamentId: string,
  listener: TournamentRealtimeListener,
) {
  const listeners =
    listenersByTournament.get(tournamentId) ??
    new Set<TournamentRealtimeListener>();
  const firstSubscriber = listeners.size === 0;
  listeners.add(listener);
  listenersByTournament.set(tournamentId, listeners);
  if (firstSubscriber && socketRef.current?.connected) {
    socketRef.current.emit("joinTournament", { tournamentId });
  }

  return () => {
    const current = listenersByTournament.get(tournamentId);
    current?.delete(listener);
    if (current?.size === 0) {
      listenersByTournament.delete(tournamentId);
      if (socketRef.current?.connected) {
        socketRef.current.emit("leaveTournament", { tournamentId });
      }
    }
  };
}
