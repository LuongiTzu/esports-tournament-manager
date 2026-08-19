-- Preserve valid legacy tournament snapshots while filling previously nullable values.
UPDATE "tournaments" AS "t"
SET
  "min_team_size" = COALESCE("t"."min_team_size", "g"."default_team_size"),
  "max_team_size" = COALESCE(
    "t"."max_team_size",
    GREATEST("g"."max_team_size", COALESCE("t"."min_team_size", "g"."default_team_size"))
  )
FROM "games" AS "g"
WHERE "t"."game_id" = "g"."id"
  AND ("t"."min_team_size" IS NULL OR "t"."max_team_size" IS NULL);

-- Repair only legacy rows whose stored maximum is below their stored minimum.
UPDATE "tournaments"
SET "max_team_size" = "min_team_size"
WHERE "max_team_size" < "min_team_size";

ALTER TABLE "tournaments"
  ALTER COLUMN "min_team_size" SET NOT NULL,
  ALTER COLUMN "max_team_size" SET NOT NULL,
  DROP COLUMN "max_substitutes",
  ADD CONSTRAINT "tournaments_roster_size_check"
    CHECK ("max_team_size" >= "min_team_size");
