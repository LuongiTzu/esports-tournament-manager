import { validate } from 'class-validator';
import { RoundFormat } from '@prisma/client';
import { CreateRoundDto, CreateTournamentDto } from './create-tournament.dto';

function dto(overrides: Partial<CreateTournamentDto> = {}) {
  return Object.assign(new CreateTournamentDto(), {
    name: 'GF-2 Cup',
    gameId: 'game-1',
    ...overrides,
  });
}

describe('CreateTournamentDto GF-2 fields', () => {
  it('accepts an integer teamSize', async () => {
    await expect(validate(dto({ teamSize: 3 }))).resolves.toHaveLength(0);
  });

  it.each([0, 1.5])('rejects invalid teamSize %s', async (teamSize) => {
    const errors = await validate(dto({ teamSize }));
    expect(errors.some((error) => error.property === 'teamSize')).toBe(true);
  });

  it('accepts a string customGameName', async () => {
    await expect(
      validate(dto({ customGameName: '  Chess  ' })),
    ).resolves.toHaveLength(0);
  });

  it('rejects a customGameName longer than 100 characters', async () => {
    const errors = await validate(dto({ customGameName: 'x'.repeat(101) }));
    expect(errors.some((error) => error.property === 'customGameName')).toBe(
      true,
    );
  });
});

describe('CreateRoundDto bestOf', () => {
  function round(bestOf: number) {
    return Object.assign(new CreateRoundDto(), {
      name: 'Playoff',
      format: RoundFormat.PLAYOFF,
      bestOf,
    });
  }

  it.each([1, 3, 5, 7, 9])('accepts generic BO%i', async (bestOf) => {
    await expect(validate(round(bestOf))).resolves.toHaveLength(0);
  });

  it.each([0, 2, 4, 8, 10])('rejects invalid BO%i', async (bestOf) => {
    const errors = await validate(round(bestOf));
    expect(errors.some((error) => error.property === 'bestOf')).toBe(true);
  });
});
