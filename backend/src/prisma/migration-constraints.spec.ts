import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const migration = readFileSync(
  resolve(
    __dirname,
    '../../prisma/migrations/20261109050000_squashed_baseline/migration.sql',
  ),
  'utf8',
);

describe('current baseline data integrity', () => {
  it('keeps catalog identity unique and allowed team sizes normalized', () => {
    expect(migration).toContain('CREATE UNIQUE INDEX "games_code_key"');
    expect(migration).toMatch(
      /CREATE TABLE "game_allowed_team_sizes"[\s\S]*?PRIMARY KEY \("game_id", "size"\)/,
    );
    expect(migration).toContain('DROP COLUMN "allowed_team_sizes"');
  });

  it('preserves nullable custom game names and valid tournament roster bounds', () => {
    expect(migration).toContain('"custom_game_name" TEXT,');
    expect(migration).toMatch(
      /ADD CONSTRAINT "tournaments_roster_size_check"\s+CHECK \("max_team_size" >= "min_team_size"\)/,
    );
  });

  it('keeps favorites unique per user and tournament with cascading cleanup', () => {
    expect(migration).toContain('PRIMARY KEY ("user_id","tournament_id")');
    expect(migration).toMatch(
      /ALTER TABLE "tournament_favorites" ADD CONSTRAINT "tournament_favorites_user_id_fkey"[^;]*ON DELETE CASCADE/,
    );
    expect(migration).toMatch(
      /ALTER TABLE "tournament_favorites" ADD CONSTRAINT "tournament_favorites_tournament_id_fkey"[^;]*ON DELETE CASCADE/,
    );
  });

  it('keeps reply lookup and restricts deletion of a parent comment', () => {
    expect(migration).toContain(
      'CREATE INDEX "comments_parent_id_created_at_idx"',
    );
    expect(migration).toMatch(
      /ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey"[^;]*ON DELETE RESTRICT/,
    );
  });

  it('allows notifications without a deduplication key but makes supplied keys unique', () => {
    expect(migration).toMatch(
      /CREATE TABLE "notifications" \([\s\S]*?"deduplication_key" TEXT,/,
    );
    expect(migration).toContain(
      'CREATE UNIQUE INDEX "notifications_deduplication_key_key"',
    );
  });
});
