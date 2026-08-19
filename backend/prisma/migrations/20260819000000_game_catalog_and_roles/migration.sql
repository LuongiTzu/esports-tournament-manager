ALTER TYPE "GameGenre" ADD VALUE 'FIGHTING';

CREATE TYPE "GamePositionMode" AS ENUM ('FIXED', 'OPTIONAL', 'NONE');

ALTER TABLE "games"
  ADD COLUMN "position_mode" "GamePositionMode" NOT NULL DEFAULT 'NONE';

-- Preserve existing tournament references while replacing the legacy name.
DO $$
DECLARE
  old_game_id TEXT;
  new_game_id TEXT;
BEGIN
  SELECT "id" INTO old_game_id FROM "games" WHERE "name" = 'CS:GO';
  SELECT "id" INTO new_game_id FROM "games" WHERE "name" = 'Counter-Strike 2';

  IF old_game_id IS NOT NULL AND new_game_id IS NULL THEN
    UPDATE "games" SET "name" = 'Counter-Strike 2' WHERE "id" = old_game_id;
  ELSIF old_game_id IS NOT NULL AND new_game_id IS NOT NULL THEN
    UPDATE "tournaments" SET "game_id" = new_game_id WHERE "game_id" = old_game_id;
  END IF;
END $$;

INSERT INTO "games" (
  "id", "name", "genre", "positions", "position_mode",
  "default_team_size", "min_team_size", "max_team_size", "created_at"
)
VALUES
  (
    'catalog_league_of_legends', 'League of Legends', 'MOBA',
    '["TOP","JUNGLE","MID","BOT","SUPPORT"]'::jsonb,
    'FIXED', 5, 5, 7, CURRENT_TIMESTAMP
  ),
  (
    'catalog_lien_quan_mobile', 'Liên Quân Mobile', 'MOBA',
    '["DARK_SLAYER_LANE","JUNGLE","MID","DRAGON_LANE","ROAM"]'::jsonb,
    'FIXED', 5, 5, 7, CURRENT_TIMESTAMP
  ),
  (
    'catalog_valorant', 'Valorant', 'FPS',
    '["DUELIST","INITIATOR","CONTROLLER","SENTINEL"]'::jsonb,
    'OPTIONAL', 5, 5, 7, CURRENT_TIMESTAMP
  ),
  (
    'catalog_counter_strike_2', 'Counter-Strike 2', 'FPS',
    '[]'::jsonb, 'NONE', 5, 5, 7, CURRENT_TIMESTAMP
  ),
  (
    'catalog_dota_2', 'Dota 2', 'MOBA',
    '["POSITION_1","POSITION_2","POSITION_3","POSITION_4","POSITION_5"]'::jsonb,
    'FIXED', 5, 5, 7, CURRENT_TIMESTAMP
  ),
  (
    'catalog_rocket_league', 'Rocket League', 'SPORTS',
    '[]'::jsonb, 'NONE', 3, 3, 4, CURRENT_TIMESTAMP
  ),
  (
    'catalog_tekken_8', 'Tekken 8', 'FIGHTING',
    '[]'::jsonb, 'NONE', 1, 1, 1, CURRENT_TIMESTAMP
  ),
  (
    'catalog_street_fighter_6', 'Street Fighter 6', 'FIGHTING',
    '[]'::jsonb, 'NONE', 1, 1, 1, CURRENT_TIMESTAMP
  )
ON CONFLICT ("name") DO UPDATE SET
  "genre" = EXCLUDED."genre",
  "positions" = EXCLUDED."positions",
  "position_mode" = EXCLUDED."position_mode",
  "default_team_size" = EXCLUDED."default_team_size",
  "min_team_size" = EXCLUDED."min_team_size",
  "max_team_size" = EXCLUDED."max_team_size";
