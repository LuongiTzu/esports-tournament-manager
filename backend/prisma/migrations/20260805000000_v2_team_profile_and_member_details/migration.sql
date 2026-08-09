-- V2: hồ sơ đội + hồ sơ thành viên chi tiết (GĐ 3.3, 3.4)
--
-- Các cột mới của teams/team_members là NOT NULL và không có default hợp lý,
-- nên dữ liệu demo của GĐ 2 (đội + roster kiểu "tên đội + list IGN") phải bị xóa.
-- Đây là chủ ý theo lộ trình GĐ 3.5, không phải mất mát ngoài ý muốn.
DELETE FROM "team_members";
DELETE FROM "teams";

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('CAPTAIN', 'PLAYER', 'SUBSTITUTE', 'COACH', 'MANAGER');

-- AlterTable
ALTER TABLE "team_members" DROP COLUMN "contact_info",
ADD COLUMN     "avatar_url" TEXT,
ADD COLUMN     "birth_date" TIMESTAMP(3),
ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "in_game_id" TEXT,
ADD COLUMN     "member_role" "MemberRole" NOT NULL DEFAULT 'PLAYER',
ADD COLUMN     "order_index" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "phone_number" TEXT,
ADD COLUMN     "position" TEXT,
ADD COLUMN     "real_name" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "teams" ADD COLUMN     "contact_email" TEXT NOT NULL,
ADD COLUMN     "contact_name" TEXT NOT NULL,
ADD COLUMN     "contact_phone" TEXT,
ADD COLUMN     "description" TEXT,
ADD COLUMN     "reject_reason" TEXT,
ADD COLUMN     "reviewed_at" TIMESTAMP(3),
ADD COLUMN     "short_name" TEXT;

-- CreateIndex
CREATE INDEX "team_members_team_id_idx" ON "team_members"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_ign_key" ON "team_members"("team_id", "ign");

-- CreateIndex
CREATE UNIQUE INDEX "teams_tournament_id_name_key" ON "teams"("tournament_id", "name");
