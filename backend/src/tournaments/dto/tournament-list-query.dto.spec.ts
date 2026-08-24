import 'reflect-metadata';
import { TournamentMode, TournamentStatus } from '@prisma/client';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TournamentListQueryDto } from './tournament-list-query.dto';

describe('TournamentListQueryDto', () => {
  it.each([
    ['true', true],
    ['false', false],
  ] as const)(
    'transforms isVerified=%s without truthiness coercion',
    async (raw, expected) => {
      const query = plainToInstance(TournamentListQueryDto, {
        status: TournamentStatus.ONGOING,
        mode: TournamentMode.ONLINE,
        isVerified: raw,
      });

      await expect(validate(query)).resolves.toHaveLength(0);
      expect(query.isVerified).toBe(expected);
    },
  );

  it.each([
    [{ isVerified: 'yes' }],
    [{ status: 'ongoing' }],
    [{ mode: 'remote' }],
  ])('rejects invalid canonical filters', async (input) => {
    const errors = await validate(
      plainToInstance(TournamentListQueryDto, input),
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});
