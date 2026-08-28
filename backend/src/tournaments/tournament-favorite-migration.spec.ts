import { readFileSync } from 'fs';
import { resolve } from 'path';

describe('TournamentFavorite baseline migration', () => {
  const migration = readFileSync(
    resolve(
      __dirname,
      '../../prisma/migrations/20260821060000_baseline/migration.sql',
    ),
    'utf8',
  );

  it('creates one composite-key Favorite/Follow relation with cascading FKs', () => {
    expect(migration).toMatch(/CREATE TABLE "tournament_favorites"/);
    expect(migration).toMatch(/PRIMARY KEY \("user_id","tournament_id"\)/);
    expect(migration).toMatch(
      /"tournament_favorites"[\s\S]*FOREIGN KEY \("user_id"\)[\s\S]*ON DELETE CASCADE/,
    );
    expect(migration).toMatch(
      /"tournament_favorites"[\s\S]*FOREIGN KEY \("tournament_id"\)[\s\S]*ON DELETE CASCADE/,
    );
  });
});
