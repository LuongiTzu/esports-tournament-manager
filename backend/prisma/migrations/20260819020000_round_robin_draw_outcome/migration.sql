CREATE TYPE "MatchOutcome" AS ENUM ('TEAM_A', 'TEAM_B', 'DRAW');

ALTER TABLE "matches" ADD COLUMN "outcome" "MatchOutcome";

UPDATE "matches"
SET "outcome" = CASE
  WHEN "winner_team_id" = "team_a_id" THEN 'TEAM_A'::"MatchOutcome"
  WHEN "winner_team_id" = "team_b_id" THEN 'TEAM_B'::"MatchOutcome"
  WHEN "status" = 'COMPLETED'
    AND "team_a_id" IS NOT NULL
    AND "team_b_id" IS NOT NULL
    AND "score_a" = "score_b"
    AND EXISTS (
      SELECT 1
      FROM "rounds"
      WHERE "rounds"."id" = "matches"."round_id"
        AND "rounds"."format" IN ('ROUND_ROBIN', 'GROUP_STAGE')
    )
    THEN 'DRAW'::"MatchOutcome"
  ELSE NULL
END
WHERE "status" = 'COMPLETED';
