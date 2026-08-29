import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Comment reply baseline migration', () => {
  const migrationsDirectory = join(process.cwd(), 'prisma', 'migrations');
  const migrationDirectories = readdirSync(migrationsDirectory, {
    withFileTypes: true,
  }).filter((entry) => entry.isDirectory());
  const migrationSql = readFileSync(
    join(migrationsDirectory, '20260821060000_baseline', 'migration.sql'),
    'utf8',
  );
  const schema = readFileSync(
    join(process.cwd(), 'prisma', 'schema.prisma'),
    'utf8',
  );

  it('keeps reply support in the baseline migration', () => {
    expect(migrationDirectories.map((entry) => entry.name)).toContain(
      '20260821060000_baseline',
    );
  });

  it('persists root, exact reply target and deletion state', () => {
    for (const column of ['parent_id', 'reply_to_user_id', 'deleted_at']) {
      expect(migrationSql).toMatch(
        new RegExp(`CREATE TABLE "comments"[\\s\\S]*"${column}"`),
      );
    }
    expect(schema).toMatch(/parentId\s+String\?/);
    expect(schema).toMatch(/replyToUserId\s+String\?/);
    expect(schema).toMatch(/deletedAt\s+DateTime\?/);
  });

  it('indexes reply lookup and prevents cascading root deletion', () => {
    expect(migrationSql).toContain(
      'CREATE INDEX "comments_parent_id_created_at_idx"',
    );
    expect(migrationSql).toMatch(
      /comments_parent_id_fkey[\s\S]*ON DELETE RESTRICT/,
    );
  });
});
