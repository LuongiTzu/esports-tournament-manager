import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { NotificationListQueryDto } from './notification-list-query.dto';

describe('NotificationListQueryDto', () => {
  it.each([
    ['true', true],
    ['false', false],
  ] as const)('transforms isRead=%s', async (raw, expected) => {
    const query = plainToInstance(NotificationListQueryDto, { isRead: raw });
    await expect(validate(query)).resolves.toHaveLength(0);
    expect(query.isRead).toBe(expected);
  });

  it('rejects an invalid read-state filter', async () => {
    const errors = await validate(
      plainToInstance(NotificationListQueryDto, { isRead: '1' }),
    );
    expect(errors.length).toBeGreaterThan(0);
  });
});
