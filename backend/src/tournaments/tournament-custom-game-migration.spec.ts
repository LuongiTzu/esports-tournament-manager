import { readFileSync } from 'fs';
import { join } from 'path';

describe('GF-2 custom game migration', () => {
  const migrationSql = readFileSync(
    join(
      process.cwd(),
      'prisma',
      'migrations',
      '20260826090000_add_tournament_custom_game_name',
      'migration.sql',
    ),
    'utf8',
  );
  const schema = readFileSync(
    join(process.cwd(), 'prisma', 'schema.prisma'),
    'utf8',
  );

  it('adds only nullable custom Tournament metadata', () => {
    expect(migrationSql).toMatch(/ADD COLUMN "custom_game_name" TEXT;/);
    expect(migrationSql).not.toMatch(/custom_game_name" TEXT NOT NULL/);
    expect(migrationSql).not.toMatch(/\b(?:DELETE|DROP)\b/);
  });

  it('keeps gameId required and snapshots teamSize only in minTeamSize', () => {
    expect(schema).toMatch(/customGameName\s+String\?/);
    expect(schema).toMatch(/gameId\s+String\s+@map\("game_id"\)/);
    expect(schema).not.toMatch(/^\s*teamSize\s+/m);
  });
});
