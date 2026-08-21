import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Database constraint migration coverage', () => {
  const migrationsDirectory = join(process.cwd(), 'prisma', 'migrations');
  const migrationSql = readdirSync(migrationsDirectory, {
    withFileTypes: true,
  })
    .filter((entry) => entry.isDirectory())
    .map((entry) =>
      readFileSync(
        join(migrationsDirectory, entry.name, 'migration.sql'),
        'utf8',
      ),
    )
    .join('\n');
  const schema = readFileSync(
    join(process.cwd(), 'prisma', 'schema.prisma'),
    'utf8',
  );

  it('keeps deduplication keys nullable and unique', () => {
    expect(schema).toMatch(
      /deduplicationKey\s+String\?\s+@unique\s+@map\("deduplication_key"\)/,
    );
    expect(migrationSql).toMatch(/"deduplication_key"\s+TEXT(?:\s*[,;])/);
    expect(migrationSql).not.toMatch(/"deduplication_key"\s+TEXT\s+NOT NULL/);
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX "notifications_deduplication_key_key"',
    );
  });

  it('preserves the tournament roster size check in migration SQL', () => {
    expect(migrationSql).toMatch(
      /ADD CONSTRAINT\s+"tournaments_roster_size_check"\s+CHECK\s*\(\s*"max_team_size"\s*>=\s*"min_team_size"\s*\)/,
    );
  });
});
