import { readFileSync } from 'fs';
import { join } from 'path';

describe('GF-1 game catalog migration', () => {
  const migrationSql = readFileSync(
    join(
      process.cwd(),
      'prisma',
      'migrations',
      '20260825090000_add_game_team_size_modes',
      'migration.sql',
    ),
    'utf8',
  );

  it('adds FIXED defaults and empty preset metadata for existing rows', () => {
    expect(migrationSql).toContain(
      '"team_size_mode" "TeamSizeMode" NOT NULL DEFAULT \'FIXED\'',
    );
    expect(migrationSql).toContain(
      '"allowed_team_sizes" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[]',
    );
    expect(migrationSql).toContain('"min_selectable_team_size" INTEGER');
    expect(migrationSql).toContain('"max_selectable_team_size" INTEGER');
  });

  it.each([
    ['Liên Quân Mobile', 'LIEN_QUAN_MOBILE'],
    ['League of Legends', 'LEAGUE_OF_LEGENDS'],
    ['Valorant', 'VALORANT'],
    ['Counter-Strike 2', 'COUNTER_STRIKE_2'],
    ['Dota 2', 'DOTA_2'],
    ['Rocket League', 'ROCKET_LEAGUE'],
    ['Tekken 8', 'TEKKEN_8'],
    ['Street Fighter 6', 'STREET_FIGHTER_6'],
  ])('backfills %s with stable code %s', (name, code) => {
    expect(migrationSql).toContain(`WHEN '${name}' THEN '${code}'`);
  });

  it('preserves unknown legacy rows and makes every code stable and unique', () => {
    expect(migrationSql).toContain(`ELSE 'LEGACY_' || "id"`);
    expect(migrationSql).toContain('ALTER COLUMN "code" SET NOT NULL');
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX "games_code_key" ON "games"("code")',
    );
    expect(migrationSql).not.toMatch(/\b(?:DELETE|DROP)\b/);
  });
});
