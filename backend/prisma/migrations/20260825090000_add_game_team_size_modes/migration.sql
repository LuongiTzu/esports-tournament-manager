-- CreateEnum
CREATE TYPE "TeamSizeMode" AS ENUM ('FIXED', 'PRESET', 'FLEXIBLE');

-- Add stable game identity and team-size metadata.
ALTER TABLE "games"
ADD COLUMN "code" TEXT,
ADD COLUMN "team_size_mode" "TeamSizeMode" NOT NULL DEFAULT 'FIXED',
ADD COLUMN "allowed_team_sizes" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN "min_selectable_team_size" INTEGER,
ADD COLUMN "max_selectable_team_size" INTEGER;

-- Preserve every existing row while assigning deterministic catalog codes.
UPDATE "games"
SET "code" = CASE "name"
  WHEN 'Liên Quân Mobile' THEN 'LIEN_QUAN_MOBILE'
  WHEN 'League of Legends' THEN 'LEAGUE_OF_LEGENDS'
  WHEN 'Valorant' THEN 'VALORANT'
  WHEN 'Counter-Strike 2' THEN 'COUNTER_STRIKE_2'
  WHEN 'Dota 2' THEN 'DOTA_2'
  WHEN 'Rocket League' THEN 'ROCKET_LEAGUE'
  WHEN 'Tekken 8' THEN 'TEKKEN_8'
  WHEN 'Street Fighter 6' THEN 'STREET_FIGHTER_6'
  ELSE 'LEGACY_' || "id"
END;

ALTER TABLE "games"
ALTER COLUMN "code" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "games_code_key" ON "games"("code");
