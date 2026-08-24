import { TOURNAMENT_EVENT_NAMES } from '../common/ports/tournament-event-publisher';
import { TournamentEventsService } from './tournament-events.service';

describe('TournamentEventsService publisher adapter', () => {
  it('forwards every frozen event name and payload without translation', () => {
    const service = new TournamentEventsService();
    const received: unknown[] = [];
    const subscription = service.events$.subscribe((event) =>
      received.push(event),
    );
    for (const event of TOURNAMENT_EVENT_NAMES) {
      service.publish({ tournamentId: 't-1', event, payload: { event } });
    }
    expect(received).toEqual(
      TOURNAMENT_EVENT_NAMES.map((event) => ({
        tournamentId: 't-1',
        event,
        payload: { event },
      })),
    );
    subscription.unsubscribe();
  });
});
