import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';
import {
  TournamentEventPublisher,
  TournamentRealtimeEvent,
} from '../common/ports/tournament-event-publisher';

export {
  TOURNAMENT_EVENT_NAMES,
  TournamentEventName,
  TournamentRealtimeEvent,
} from '../common/ports/tournament-event-publisher';

@Injectable()
export class TournamentEventsService implements TournamentEventPublisher {
  private readonly subject = new Subject<TournamentRealtimeEvent>();
  readonly events$ = this.subject.asObservable();

  publish(event: TournamentRealtimeEvent): void {
    this.subject.next(event);
  }
}
