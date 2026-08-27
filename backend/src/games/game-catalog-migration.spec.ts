import { readFileSync } from 'fs';
import { join } from 'path';

describe('GF-1 game catalog baseline migration', () => {
  const migrationSql = readFileSync(
    join(
      process.cwd(),
      'prisma',
      'migrations',
      '20260821060000_baseline',
      'migration.sql',
    ),
    'utf8',
  );

  it('creates stable game identity and team-size metadata', () => {
    expect(migrationSql).toContain('"code" TEXT NOT NULL');
    expect(migrationSql).toContain(
      '"team_size_mode" "TeamSizeMode" NOT NULL DEFAULT \'FIXED\'',
    );
    expect(migrationSql).toContain(
      '"allowed_team_sizes" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[]',
    );
    expect(migrationSql).toContain('"min_selectable_team_size" INTEGER');
    expect(migrationSql).toContain('"max_selectable_team_size" INTEGER');
  });

  it('makes every game code unique', () => {
    expect(migrationSql).toContain(
      'CREATE UNIQUE INDEX "games_code_key" ON "games"("code")',
    );
  });
});
