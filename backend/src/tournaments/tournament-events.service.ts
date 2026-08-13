import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

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

@Injectable()
export class TournamentEventsService {
  private readonly subject = new Subject<TournamentRealtimeEvent>();
  readonly events$ = this.subject.asObservable();

  publish(event: TournamentRealtimeEvent): void {
    this.subject.next(event);
  }
}
