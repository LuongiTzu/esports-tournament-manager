export const TOURNAMENT_EVENT_PUBLISHER = Symbol('TOURNAMENT_EVENT_PUBLISHER');

export const TOURNAMENT_EVENT_NAMES = [
  'matchUpdated',
  'scheduleUpdated',
  'bracketGenerated',
  'teamApproved',
  'newComment',
  'standingsUpdated',
] as const;

export type TournamentEventName = (typeof TOURNAMENT_EVENT_NAMES)[number];

export interface TournamentRealtimeEvent {
  tournamentId: string;
  event: TournamentEventName;
  payload: unknown;
}

export interface TournamentEventPublisher {
  publish(event: TournamentRealtimeEvent): void;
}

export const NOOP_TOURNAMENT_EVENT_PUBLISHER: TournamentEventPublisher = {
  publish: () => undefined,
};
