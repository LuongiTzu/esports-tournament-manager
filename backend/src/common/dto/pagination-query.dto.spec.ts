import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PaginationQueryDto } from './pagination-query.dto';

describe('PaginationQueryDto', () => {
  it('transforms canonical numeric query strings', async () => {
    const pipe = new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    });
    const query = await pipe.transform(
      { page: '2', limit: '20' },
      { type: 'query', metatype: PaginationQueryDto },
    );

    expect(query).toMatchObject({ page: 2, limit: 20 });
  });

  it.each([
    ['non-numeric page', { page: 'two' }],
    ['fractional limit', { limit: '1.5' }],
    ['page below one', { page: '0' }],
  ])('rejects %s', async (_case, input) => {
    const errors = await validate(plainToInstance(PaginationQueryDto, input));
    expect(errors.length).toBeGreaterThan(0);
  });

  it('keeps missing pagination values optional for feature defaults', async () => {
    const query = plainToInstance(PaginationQueryDto, {});
    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query.page).toBeUndefined();
    expect(query.limit).toBeUndefined();
  });
});
