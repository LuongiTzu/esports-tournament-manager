import { BracketType, MatchStatus, RoundFormat } from '@prisma/client';
import {
  evaluateRoundCompletion,
  RoundCompletionMatch,
} from './round-completion';

const completedMatch = (
  overrides: Partial<RoundCompletionMatch> = {},
): RoundCompletionMatch => ({
  status: MatchStatus.COMPLETED,
  isActive: true,
  isBye: false,
  bracketRound: 1,
  bracketType: null,
  matchNumber: 1,
  groupId: null,
  winnerTeamId: 'team-1',
  ...overrides,
});

describe('round completion policy', () => {
  describe('ROUND_ROBIN', () => {
    const settings = {
      advancingTeamCount: 2,
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      allowDraws: true,
      meetingsPerPair: 1,
    };

    it('requires a generated structure', () => {
      expect(
        evaluateRoundCompletion({
          format: RoundFormat.ROUND_ROBIN,
          settings,
          participantCount: 4,
          matches: [],
        }),
      ).toMatchObject({ completed: false, code: 'NO_STRUCTURE' });
    });

    it('rejects a partial schedule even when every persisted match completed', () => {
      expect(
        evaluateRoundCompletion({
          format: RoundFormat.ROUND_ROBIN,
          settings,
          participantCount: 4,
          matches: Array.from({ length: 5 }, () => completedMatch()),
        }),
      ).toMatchObject({
        completed: false,
        code: 'INVALID_STRUCTURE',
        expectedMatchCount: 6,
      });
    });

    it('does not treat inactive regular matches as completed work', () => {
      const matches = Array.from({ length: 6 }, () => completedMatch());
      matches[5] = completedMatch({ isActive: false });
      expect(
        evaluateRoundCompletion({
          format: RoundFormat.ROUND_ROBIN,
          settings,
          participantCount: 4,
          matches,
        }).code,
      ).toBe('INVALID_STRUCTURE');
    });

    it('completes only after every expected meeting completes', () => {
      const matches = Array.from({ length: 6 }, () => completedMatch());
      matches[5] = completedMatch({ status: MatchStatus.PENDING });
      expect(
        evaluateRoundCompletion({
          format: RoundFormat.ROUND_ROBIN,
          settings,
          participantCount: 4,
          matches,
        }).code,
      ).toBe('MATCHES_PENDING');

      matches[5] = completedMatch();
      expect(
        evaluateRoundCompletion({
          format: RoundFormat.ROUND_ROBIN,
          settings,
          participantCount: 4,
          matches,
        }),
      ).toMatchObject({ completed: true, code: 'COMPLETED' });
    });
  });

  describe('GROUP_STAGE', () => {
    const settings = {
      numberOfGroups: 2,
      advancingTeamsPerGroup: 1,
      winPoints: 3,
      drawPoints: 1,
      lossPoints: 0,
      allowDraws: true,
      meetingsPerPair: 1,
    };
    const groups = [
      { id: 'group-a', teamCount: 2 },
      { id: 'group-b', teamCount: 2 },
    ];

    it('requires equal persisted groups and the expected matches per group', () => {
      expect(
        evaluateRoundCompletion({
          format: RoundFormat.GROUP_STAGE,
          settings,
          participantCount: 4,
          groups: [{ id: 'group-a', teamCount: 4 }],
          matches: [completedMatch({ groupId: 'group-a' })],
        }),
      ).toMatchObject({ completed: false, code: 'INVALID_STRUCTURE' });
    });

    it('completes after all group schedules complete', () => {
      expect(
        evaluateRoundCompletion({
          format: RoundFormat.GROUP_STAGE,
          settings,
          participantCount: 4,
          groups,
          matches: [
            completedMatch({ groupId: 'group-a' }),
            completedMatch({ groupId: 'group-b' }),
          ],
        }),
      ).toMatchObject({
        completed: true,
        code: 'COMPLETED',
        expectedMatchCount: 2,
      });
    });
  });

  describe('SWISS', () => {
    const settings = { numberOfRounds: null, advancingTeamCount: 4 };
    const iteration = (
      round: number,
      status: MatchStatus = MatchStatus.COMPLETED,
    ) =>
      Array.from({ length: 4 }, (_, index) =>
        completedMatch({
          status,
          bracketRound: round,
          matchNumber: index + 1,
        }),
      );

    it('reports completed pairings while more resolved iterations remain', () => {
      expect(
        evaluateRoundCompletion({
          format: RoundFormat.SWISS,
          settings,
          participantCount: 8,
          matches: [...iteration(1), ...iteration(2)],
        }),
      ).toMatchObject({
        completed: false,
        code: 'SWISS_ITERATIONS_PENDING',
        currentSwissIteration: 2,
        resolvedSwissIterations: 3,
        expectedMatchCount: 12,
      });
    });

    it('requires all matches in the final iteration to complete', () => {
      expect(
        evaluateRoundCompletion({
          format: RoundFormat.SWISS,
          settings,
          participantCount: 8,
          matches: [
            ...iteration(1),
            ...iteration(2),
            ...iteration(3, MatchStatus.PENDING),
          ],
        }).code,
      ).toBe('MATCHES_PENDING');
    });

    it('completes after every resolved iteration', () => {
      expect(
        evaluateRoundCompletion({
          format: RoundFormat.SWISS,
          settings,
          participantCount: 8,
          matches: [...iteration(1), ...iteration(2), ...iteration(3)],
        }),
      ).toMatchObject({ completed: true, code: 'COMPLETED' });
    });

    it('rejects incomplete or non-consecutive pairing structures', () => {
      expect(
        evaluateRoundCompletion({
          format: RoundFormat.SWISS,
          settings,
          participantCount: 8,
          matches: [...iteration(1), ...iteration(3)],
        }).code,
      ).toBe('INVALID_STRUCTURE');
    });
  });

  describe('PLAYOFF', () => {
    const settings = { thirdPlaceMatch: true };
    const structure = () => [
      completedMatch({ bracketRound: 1, matchNumber: 1 }),
      completedMatch({ bracketRound: 1, matchNumber: 2 }),
      completedMatch({ bracketRound: 2, matchNumber: 1 }),
      completedMatch({ bracketRound: 2, matchNumber: 2 }),
    ];

    it('requires the optional third-place match when configured', () => {
      expect(
        evaluateRoundCompletion({
          format: RoundFormat.PLAYOFF,
          settings,
          participantCount: 4,
          matches: structure().slice(0, 3),
        }).code,
      ).toBe('INVALID_STRUCTURE');
    });

    it('requires a completed championship with a winner', () => {
      const matches = structure();
      matches[2] = completedMatch({
        bracketRound: 2,
        matchNumber: 1,
        winnerTeamId: null,
      });
      expect(
        evaluateRoundCompletion({
          format: RoundFormat.PLAYOFF,
          settings,
          participantCount: 4,
          matches,
        }).code,
      ).toBe('INVALID_STRUCTURE');
    });

    it('completes a valid elimination structure', () => {
      expect(
        evaluateRoundCompletion({
          format: RoundFormat.PLAYOFF,
          settings,
          participantCount: 4,
          matches: structure(),
        }),
      ).toMatchObject({ completed: true, code: 'COMPLETED' });
    });
  });

  describe('DOUBLE_ELIM', () => {
    const settings = { grandFinalReset: true };
    const structure = () => [
      ...Array.from({ length: 3 }, (_, index) =>
        completedMatch({
          bracketType: BracketType.WINNER,
          bracketRound: index < 2 ? 1 : 2,
          matchNumber: index < 2 ? index + 1 : 1,
        }),
      ),
      ...Array.from({ length: 2 }, (_, index) =>
        completedMatch({
          bracketType: BracketType.LOSER,
          bracketRound: index + 1,
        }),
      ),
      completedMatch({ bracketRound: 3, matchNumber: 1 }),
      completedMatch({
        status: MatchStatus.PENDING,
        isActive: false,
        bracketRound: 4,
        matchNumber: 1,
        winnerTeamId: null,
      }),
    ];

    it('ignores an inactive conditional reset after the Grand Final', () => {
      expect(
        evaluateRoundCompletion({
          format: RoundFormat.DOUBLE_ELIM,
          settings,
          participantCount: 4,
          matches: structure(),
        }),
      ).toMatchObject({
        completed: true,
        code: 'COMPLETED',
        expectedMatchCount: 7,
        requiredMatchCount: 6,
      });
    });

    it('requires an activated reset to complete', () => {
      const matches = structure();
      matches[6] = completedMatch({
        status: MatchStatus.PENDING,
        isActive: true,
        bracketRound: 4,
        matchNumber: 1,
        winnerTeamId: null,
      });
      expect(
        evaluateRoundCompletion({
          format: RoundFormat.DOUBLE_ELIM,
          settings,
          participantCount: 4,
          matches,
        }).code,
      ).toBe('MATCHES_PENDING');

      matches[6] = completedMatch({
        bracketRound: 4,
        matchNumber: 1,
      });
      expect(
        evaluateRoundCompletion({
          format: RoundFormat.DOUBLE_ELIM,
          settings,
          participantCount: 4,
          matches,
        }).completed,
      ).toBe(true);
    });
  });

  it('rejects participant counts outside the supported limits', () => {
    expect(
      evaluateRoundCompletion({
        format: RoundFormat.DOUBLE_ELIM,
        settings: { grandFinalReset: false },
        participantCount: 3,
        matches: [completedMatch()],
      }).code,
    ).toBe('INVALID_PARTICIPANT_COUNT');
  });
});
