-- Persist optional Double Elimination reset finals without making them playable early.
CREATE TYPE "MatchActivationCondition" AS ENUM (
    'LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL'
);

ALTER TABLE "matches"
    ADD COLUMN "is_active" BOOLEAN NOT NULL DEFAULT true,
    ADD COLUMN "activation_condition" "MatchActivationCondition";

CREATE INDEX "matches_activation_condition_is_active_idx"
ON "matches"("activation_condition", "is_active");
