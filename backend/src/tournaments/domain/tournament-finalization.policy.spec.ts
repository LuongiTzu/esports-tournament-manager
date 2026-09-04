import { RoundFormat } from '@prisma/client';
import { resolveTournamentFinalizationMode } from './tournament-finalization.policy';

describe('resolveTournamentFinalizationMode', () => {
  it.each([RoundFormat.ROUND_ROBIN, RoundFormat.SWISS])(
    'requires organizer confirmation for %s',
    (format) => {
      expect(resolveTournamentFinalizationMode(format)).toBe(
        'MANUAL_STANDINGS',
      );
    },
  );

  it.each([RoundFormat.PLAYOFF, RoundFormat.DOUBLE_ELIM])(
    'uses automatic elimination completion for %s',
    (format) => {
      expect(resolveTournamentFinalizationMode(format)).toBe(
        'AUTOMATIC_ELIMINATION',
      );
    },
  );

  it('does not infer one champion from independent group tables', () => {
    expect(resolveTournamentFinalizationMode(RoundFormat.GROUP_STAGE)).toBe(
      'UNSUPPORTED',
    );
  });
});
