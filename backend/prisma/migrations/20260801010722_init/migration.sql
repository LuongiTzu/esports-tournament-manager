-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SIGNED_UP_USER');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('ACTIVE', 'HIDDEN_BY_ADMIN');

-- CreateEnum
CREATE TYPE "RoundFormat" AS ENUM ('ROUND_ROBIN', 'GROUP_STAGE', 'SWISS', 'PLAYOFF', 'DOUBLE_ELIM');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'ONGOING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "BracketType" AS ENUM ('WINNER', 'LOSER');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SCHEDULE_CHANGE', 'SCORE_UPDATE', 'TEAM_APPROVED', 'TEAM_REJECTED', 'ADMIN_WARNING', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('GAMBLING', 'SCAM', 'INAPPROPRIATE_CONTENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "BannedKeywordCategory" AS ENUM ('GAMBLING', 'PROFANITY', 'MALICIOUS_LINK');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "role" "Role" NOT NULL DEFAULT 'SIGNED_UP_USER',
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon_url" TEXT,
    "team_size" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "rules" TEXT,
    "banner_url" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "registration_open" BOOLEAN NOT NULL DEFAULT true,
    "max_teams" INTEGER,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "game_id" TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "format" "RoundFormat" NOT NULL,
    "settings" JSONB,
    "status" "RoundStatus" NOT NULL DEFAULT 'UPCOMING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tournament_id" TEXT NOT NULL,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "round_id" TEXT NOT NULL,

    CONSTRAINT "groups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "group_teams" (
    "group_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,

    CONSTRAINT "group_teams_pkey" PRIMARY KEY ("group_id","team_id")
);

-- CreateTable
CREATE TABLE "teams" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "logo_url" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "seed" INTEGER,
    "final_rank" INTEGER,
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "captain_id" TEXT NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "ign" TEXT NOT NULL,
    "contact_info" TEXT,
    "user_id" TEXT,
    "team_id" TEXT NOT NULL,

    CONSTRAINT "team_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "matches" (
    "id" TEXT NOT NULL,
    "score_a" INTEGER NOT NULL DEFAULT 0,
    "score_b" INTEGER NOT NULL DEFAULT 0,
    "status" "MatchStatus" NOT NULL DEFAULT 'PENDING',
    "bracket_type" "BracketType",
    "bracket_round" INTEGER,
    "match_number" INTEGER,
    "scheduled_at" TIMESTAMP(3),
    "played_at" TIMESTAMP(3),
    "discord_link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "round_id" TEXT NOT NULL,
    "group_id" TEXT,
    "team_a_id" TEXT,
    "team_b_id" TEXT,
    "winner_team_id" TEXT,
    "next_match_id" TEXT,
    "loser_next_match_id" TEXT,

    CONSTRAINT "matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_scores" (
    "id" TEXT NOT NULL,
    "set_number" INTEGER NOT NULL,
    "team_a_score" INTEGER NOT NULL DEFAULT 0,
    "team_b_score" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "match_id" TEXT NOT NULL,

    CONSTRAINT "match_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "is_hidden" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "author_id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "content" TEXT NOT NULL,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "user_id" TEXT NOT NULL,
    "tournament_id" TEXT,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "description" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'PENDING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_at" TIMESTAMP(3),
    "tournament_id" TEXT NOT NULL,
    "reporter_user_id" TEXT,
    "reviewed_by" TEXT,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "banned_keywords" (
    "id" TEXT NOT NULL,
    "keyword" TEXT NOT NULL,
    "category" "BannedKeywordCategory" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "banned_keywords_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "games_name_key" ON "games"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");

-- CreateIndex
CREATE INDEX "tournaments_game_id_visibility_moderation_status_idx" ON "tournaments"("game_id", "visibility", "moderation_status");

-- CreateIndex
CREATE INDEX "rounds_tournament_id_order_index_idx" ON "rounds"("tournament_id", "order_index");

-- CreateIndex
CREATE INDEX "groups_round_id_idx" ON "groups"("round_id");

-- CreateIndex
CREATE INDEX "teams_tournament_id_status_idx" ON "teams"("tournament_id", "status");

-- CreateIndex
CREATE INDEX "teams_captain_id_idx" ON "teams"("captain_id");

-- CreateIndex
CREATE INDEX "matches_round_id_group_id_idx" ON "matches"("round_id", "group_id");

-- CreateIndex
CREATE INDEX "matches_team_a_id_team_b_id_idx" ON "matches"("team_a_id", "team_b_id");

-- CreateIndex
CREATE INDEX "match_scores_match_id_idx" ON "match_scores"("match_id");

-- CreateIndex
CREATE INDEX "comments_tournament_id_created_at_idx" ON "comments"("tournament_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_user_id_is_read_created_at_idx" ON "notifications"("user_id", "is_read", "created_at");

-- CreateIndex
CREATE INDEX "reports_status_created_at_idx" ON "reports"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "banned_keywords_keyword_key" ON "banned_keywords"("keyword");

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_game_id_fkey" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournaments" ADD CONSTRAINT "tournaments_organizer_id_fkey" FOREIGN KEY ("organizer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "groups" ADD CONSTRAINT "groups_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_teams" ADD CONSTRAINT "group_teams_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "group_teams" ADD CONSTRAINT "group_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "teams" ADD CONSTRAINT "teams_captain_id_fkey" FOREIGN KEY ("captain_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_a_id_fkey" FOREIGN KEY ("team_a_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_team_b_id_fkey" FOREIGN KEY ("team_b_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_winner_team_id_fkey" FOREIGN KEY ("winner_team_id") REFERENCES "teams"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_next_match_id_fkey" FOREIGN KEY ("next_match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "matches" ADD CONSTRAINT "matches_loser_next_match_id_fkey" FOREIGN KEY ("loser_next_match_id") REFERENCES "matches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_scores" ADD CONSTRAINT "match_scores_match_id_fkey" FOREIGN KEY ("match_id") REFERENCES "matches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporter_user_id_fkey" FOREIGN KEY ("reporter_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
