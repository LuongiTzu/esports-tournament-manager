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

export type NotificationRealtimeListener = (
  notification: NotificationRecord,
) => void;

export type TournamentRealtimeListener = (
  event: TournamentRealtimeEvent,
  payload: unknown,
) => void;
