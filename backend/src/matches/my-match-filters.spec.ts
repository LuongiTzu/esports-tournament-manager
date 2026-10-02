import { BadRequestException } from '@nestjs/common';
import { myMatchFilters } from './my-match-filters';

const now = new Date('2030-06-15T12:00:00Z');

describe('personal match filters', () => {
  it('limits check-in tasks to assigned captain teams without a check-in and an open window', () => {
    expect(myMatchFilters({ attention: 'CHECK_IN' }, ['mine'], now)).toEqual([
      {
        status: 'PENDING',
        scheduledAt: { gte: now, lte: new Date('2030-06-15T12:30:00Z') },
        OR: [
          {
            OR: [{ teamAId: 'mine' }, { teamBId: 'mine' }],
            checkIns: { none: { teamId: 'mine' } },
          },
        ],
      },
    ]);
  });
  it('does not offer captain actions to ordinary members', () => {
    expect(myMatchFilters({ attention: 'CONFIRM' }, [], now)).toEqual([
      { status: 'COMPLETED', OR: [] },
    ]);
  });
  it('excludes already answered or finalized reviews from confirmation tasks', () => {
    expect(myMatchFilters({ attention: 'CONFIRM' }, ['mine'], now)).toEqual([
      {
        status: 'COMPLETED',
        OR: [
          {
            OR: [{ teamAId: 'mine' }, { teamBId: 'mine' }],
            resultReview: {
              is: {
                status: 'PENDING_CONFIRMATION',
                responses: { none: { teamId: 'mine' } },
              },
            },
          },
        ],
      },
    ]);
  });
  it('rejects an inverted range', () => {
    expect(() =>
      myMatchFilters(
        { from: '2030-06-16T00:00:00Z', to: '2030-06-15T00:00:00Z' },
        [],
        now,
      ),
    ).toThrow(BadRequestException);
  });
  it('uses played time for completed matches and scheduled time otherwise, with a legacy fallback', () => {
    const gte = new Date('2030-06-15T00:00:00Z');
    expect(myMatchFilters({ from: gte.toISOString() }, [], now)).toEqual([
      {
        OR: [
          { status: 'COMPLETED', playedAt: { gte, lte: undefined } },
          {
            status: 'COMPLETED',
            playedAt: null,
            scheduledAt: { gte, lte: undefined },
          },
          {
            status: { not: 'COMPLETED' },
            scheduledAt: { gte, lte: undefined },
          },
        ],
      },
    ]);
  });
});
