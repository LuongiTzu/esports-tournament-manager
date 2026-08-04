-- CreateEnum
CREATE TYPE "GameGenre" AS ENUM ('MOBA', 'FPS', 'SPORTS', 'BATTLE_ROYALE', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TournamentMode" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');

-- AlterTable: games
-- Giữ lại dữ liệu cũ: team_size đổi tên thành default_team_size,
-- min/max suy ra từ giá trị cũ rồi seed sẽ ghi đè bằng số liệu chuẩn theo từng game.
ALTER TABLE "games" RENAME COLUMN "team_size" TO "default_team_size";

ALTER TABLE "games"
  ADD COLUMN "genre" "GameGenre" NOT NULL DEFAULT 'OTHER',
  ADD COLUMN "positions" JSONB,
  ADD COLUMN "min_team_size" INTEGER,
  ADD COLUMN "max_team_size" INTEGER;

UPDATE "games"
SET "min_team_size" = "default_team_size",
    "max_team_size" = "default_team_size" + 2
WHERE "min_team_size" IS NULL;

ALTER TABLE "games"
  ALTER COLUMN "min_team_size" SET NOT NULL,
  ALTER COLUMN "max_team_size" SET NOT NULL;

-- AlterTable: tournaments — bổ sung setting mở rộng (V2)
ALTER TABLE "tournaments"
  ADD COLUMN "status" "TournamentStatus" NOT NULL DEFAULT 'REGISTRATION',
  ADD COLUMN "mode" "TournamentMode" NOT NULL DEFAULT 'ONLINE',
  ADD COLUMN "location" TEXT,
  ADD COLUMN "min_team_size" INTEGER,
  ADD COLUMN "max_team_size" INTEGER,
  ADD COLUMN "max_substitutes" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "min_age" INTEGER,
  ADD COLUMN "max_age" INTEGER,
  ADD COLUMN "allowed_genders" JSONB,
  ADD COLUMN "registration_start_date" TIMESTAMP(3),
  ADD COLUMN "registration_deadline" TIMESTAMP(3),
  ADD COLUMN "auto_approve_teams" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "require_member_full_info" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "prize_pool" TEXT,
  ADD COLUMN "contact_email" TEXT,
  ADD COLUMN "contact_phone" TEXT,
  ADD COLUMN "contact_link" TEXT;

-- CreateIndex
CREATE INDEX "tournaments_status_start_date_idx" ON "tournaments"("status", "start_date");
