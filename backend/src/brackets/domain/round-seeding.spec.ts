import {
  assignRoundSeeds,
  interleaveGroupQualificationOrder,
} from './round-seeding';

describe('Round seeding', () => {
  it('assigns a dense one-based seed from qualification order', () => {
    expect(assignRoundSeeds(['alpha', 'bravo', 'charlie'])).toEqual([
      { teamId: 'alpha', seed: 1 },
      { teamId: 'bravo', seed: 2 },
      { teamId: 'charlie', seed: 3 },
    ]);
  });

  it('rejects duplicate qualification entries', () => {
    expect(() => assignRoundSeeds(['alpha', 'alpha'])).toThrow(
      'Round seed input must contain unique team IDs',
    );
  });

  it('interleaves group qualifiers by place then group order', () => {
    expect(
      interleaveGroupQualificationOrder([
        { orderIndex: 2, teamIds: ['b1', 'b2'] },
        { orderIndex: 1, teamIds: ['a1', 'a2'] },
      ]),
    ).toEqual(['a1', 'b1', 'a2', 'b2']);
  });
});
