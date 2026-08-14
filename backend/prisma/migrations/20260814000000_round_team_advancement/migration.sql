-- Persist the eligible participant set passed from one configured round to the next.
CREATE TABLE "round_teams" (
    "round_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "advanced_from_round_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "round_teams_pkey" PRIMARY KEY ("round_id", "team_id")
);

CREATE UNIQUE INDEX "round_teams_advanced_from_round_id_team_id_key"
ON "round_teams"("advanced_from_round_id", "team_id");

CREATE INDEX "round_teams_advanced_from_round_id_idx"
ON "round_teams"("advanced_from_round_id");

CREATE INDEX "round_teams_team_id_idx"
ON "round_teams"("team_id");

ALTER TABLE "round_teams"
ADD CONSTRAINT "round_teams_round_id_fkey"
FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "round_teams"
ADD CONSTRAINT "round_teams_team_id_fkey"
FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "round_teams"
ADD CONSTRAINT "round_teams_advanced_from_round_id_fkey"
FOREIGN KEY ("advanced_from_round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;
