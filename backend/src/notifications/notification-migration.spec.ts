import { readFileSync } from 'fs';
import { join } from 'path';

describe('Notification deduplication migration', () => {
  const schema = readFileSync(
    join(process.cwd(), 'prisma', 'schema.prisma'),
    'utf8',
  );
  const migration = readFileSync(
    join(
      process.cwd(),
      'prisma',
      'migrations',
      '20260814020000_notification_deduplication_key',
      'migration.sql',
    ),
    'utf8',
  );

  it('keeps schema and migration nullable and uniquely indexed', () => {
    expect(schema).toContain(
      'deduplicationKey String?  @unique @map("deduplication_key")',
    );
    expect(migration).toContain('ADD COLUMN "deduplication_key" TEXT;');
    expect(migration).not.toMatch(
      /ADD COLUMN "deduplication_key" TEXT NOT NULL/,
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "notifications_deduplication_key_key"',
    );
  });
});
