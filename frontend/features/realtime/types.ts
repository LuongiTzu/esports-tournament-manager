import type { NotificationRecord } from "@/features/notifications/types";

export const TOURNAMENT_REALTIME_EVENTS = [
  "matchUpdated",
  "scheduleUpdated",
  "bracketGenerated",
  "teamApproved",
  "newComment",
  "standingsUpdated",
] as const;

export type TournamentRealtimeEvent =
  (typeof TOURNAMENT_REALTIME_EVENTS)[number];

export interface TournamentRealtimeEnvelope {
  tournamentId: string;
  data: unknown;
}

export type NotificationRealtimeListener = (
  notification: NotificationRecord,
) => void;

export type TournamentRealtimeListener = (
  event: TournamentRealtimeEvent,
  payload: unknown,
) => void;

export function isTournamentRealtimeEnvelope(
  value: unknown,
): value is TournamentRealtimeEnvelope {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.tournamentId === "string" &&
    candidate.tournamentId.length > 0 &&
    Object.prototype.hasOwnProperty.call(candidate, "data")
  );
}

export function dispatchTournamentRealtimeEvent(
  event: TournamentRealtimeEvent,
  envelope: TournamentRealtimeEnvelope,
  listenersByTournament: ReadonlyMap<
    string,
    ReadonlySet<TournamentRealtimeListener>
  >,
): boolean {
  const listeners = listenersByTournament.get(envelope.tournamentId);
  if (!listeners?.size) return false;
  listeners.forEach((listener) => listener(event, envelope.data));
  return true;
}
