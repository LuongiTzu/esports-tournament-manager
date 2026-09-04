import { analyzeQualificationBoundary } from './qualification-boundary';

const row = (teamId: string, ...metrics: number[]) => ({ teamId, metrics });

describe('qualification boundary analysis', () => {
  it('returns the configured leaders when the boundary is distinct', () => {
    expect(
      analyzeQualificationBoundary(
        [row('a', 9, 3), row('b', 6, 2), row('c', 3, 1)],
        2,
      ),
    ).toEqual({ automaticTeamIds: ['a', 'b'], tie: null });
  });

  it('does not require a decision when an entire tie band qualifies', () => {
    expect(
      analyzeQualificationBoundary([row('a', 9), row('b', 6), row('c', 3)], 2)
        .tie,
    ).toBeNull();
  });

  it('reports candidates when a tie band crosses the final slot', () => {
    expect(
      analyzeQualificationBoundary(
        [row('a', 9), row('b', 6), row('c', 6), row('d', 3)],
        2,
      ).tie,
    ).toEqual({
      guaranteedTeamIds: ['a'],
      candidateTeamIds: ['b', 'c'],
      requiredSelections: 1,
    });
  });

  it('supports multiple open slots inside the same tie band', () => {
    expect(
      analyzeQualificationBoundary(
        [row('a', 9), row('b', 6), row('c', 6), row('d', 6)],
        3,
      ).tie,
    ).toEqual({
      guaranteedTeamIds: ['a'],
      candidateTeamIds: ['b', 'c', 'd'],
      requiredSelections: 2,
    });
  });
});
