import { RoundFormat } from '@prisma/client';
import {
  ELIMINATION_MUST_BE_TERMINAL,
  TournamentFormatPolicy,
} from './tournament-format.policy';

describe('TournamentFormatPolicy', () => {
  const policy = new TournamentFormatPolicy();

  it('allows a scoring stage followed by an elimination final', () => {
    expect(
      policy.validateSequence([RoundFormat.GROUP_STAGE, RoundFormat.PLAYOFF]),
    ).toBeNull();
  });

  it.each([RoundFormat.PLAYOFF, RoundFormat.DOUBLE_ELIM])(
    'rejects a Round after terminal format %s',
    (terminalFormat) => {
      expect(
        policy.validateSequence([
          RoundFormat.ROUND_ROBIN,
          terminalFormat,
          RoundFormat.ROUND_ROBIN,
        ]),
      ).toEqual(
        expect.objectContaining({
          code: ELIMINATION_MUST_BE_TERMINAL,
          terminalFormat,
          terminalOrderIndex: 2,
          attemptedOrderIndex: 3,
        }),
      );
    },
  );
});
