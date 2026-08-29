-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'SIGNED_UP_USER');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "GameGenre" AS ENUM ('MOBA', 'FPS', 'SPORTS', 'BATTLE_ROYALE', 'FIGHTING', 'CARD', 'OTHER');

-- CreateEnum
CREATE TYPE "GamePositionMode" AS ENUM ('FIXED', 'OPTIONAL', 'NONE');

-- CreateEnum
CREATE TYPE "TeamSizeMode" AS ENUM ('FIXED', 'PRESET', 'FLEXIBLE');

-- CreateEnum
CREATE TYPE "Visibility" AS ENUM ('PUBLIC', 'PRIVATE');

-- CreateEnum
CREATE TYPE "TournamentStatus" AS ENUM ('DRAFT', 'REGISTRATION', 'ONGOING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "TournamentMode" AS ENUM ('ONLINE', 'OFFLINE', 'HYBRID');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('ACTIVE', 'HIDDEN_BY_ADMIN');

-- CreateEnum
CREATE TYPE "RoundFormat" AS ENUM ('ROUND_ROBIN', 'GROUP_STAGE', 'SWISS', 'PLAYOFF', 'DOUBLE_ELIM');

-- CreateEnum
CREATE TYPE "RoundStatus" AS ENUM ('UPCOMING', 'ONGOING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "MemberRole" AS ENUM ('CAPTAIN', 'PLAYER', 'SUBSTITUTE', 'COACH', 'MANAGER');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('PENDING', 'ONGOING', 'COMPLETED');

-- CreateEnum
CREATE TYPE "MatchOutcome" AS ENUM ('TEAM_A', 'TEAM_B', 'DRAW');

-- CreateEnum
CREATE TYPE "MatchActivationCondition" AS ENUM ('LOSER_BRACKET_CHAMPION_WINS_GRAND_FINAL');

-- CreateEnum
CREATE TYPE "BracketType" AS ENUM ('WINNER', 'LOSER');

-- CreateEnum
CREATE TYPE "MatchSlot" AS ENUM ('A', 'B');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('SCHEDULE_CHANGE', 'SCORE_UPDATE', 'TEAM_REGISTERED', 'TEAM_APPROVED', 'TEAM_REJECTED', 'TOURNAMENT_STATUS', 'REPORT_THRESHOLD', 'ADMIN_WARNING', 'COMMENT_REPLY', 'SYSTEM');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('GAMBLING', 'MINOR_SAFETY', 'HARASSMENT_OR_HATE', 'VIOLENCE_OR_SELF_HARM', 'RESTRICTED_GOODS', 'ADULT_CONTENT', 'SCAM', 'INTELLECTUAL_PROPERTY', 'SPAM_OR_MALICIOUS_LINKS', 'INAPPROPRIATE_CONTENT', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('PENDING', 'REVIEWED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "BannedKeywordCategory" AS ENUM ('GAMBLING', 'PROFANITY', 'MALICIOUS_LINK');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT,
    "google_subject" TEXT,
    "display_name" TEXT NOT NULL,
    "avatar_url" TEXT,
    "birth_date" TIMESTAMP(3),
    "current_address" TEXT,
    "phone_number" TEXT,
    "gender" "Gender",
    "bio" TEXT,
    "role" "Role" NOT NULL DEFAULT 'SIGNED_UP_USER',
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "refresh_token" TEXT,
    "token_version" INTEGER NOT NULL DEFAULT 0,
    "reset_password_token" TEXT,
    "reset_password_expires" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "games" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon_url" TEXT,
    "genre" "GameGenre" NOT NULL DEFAULT 'OTHER',
    "positions" JSONB,
    "position_mode" "GamePositionMode" NOT NULL DEFAULT 'NONE',
    "team_size_mode" "TeamSizeMode" NOT NULL DEFAULT 'FIXED',
    "default_team_size" INTEGER NOT NULL,
    "min_team_size" INTEGER NOT NULL,
    "max_team_size" INTEGER NOT NULL,
    "allowed_team_sizes" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
    "min_selectable_team_size" INTEGER,
    "max_selectable_team_size" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "games_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournaments" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "custom_game_name" TEXT,
    "rules" TEXT,
    "banner_url" TEXT,
    "visibility" "Visibility" NOT NULL DEFAULT 'PUBLIC',
    "moderation_status" "ModerationStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "registration_open" BOOLEAN NOT NULL DEFAULT true,
    "max_teams" INTEGER,
    "start_date" TIMESTAMP(3),
    "end_date" TIMESTAMP(3),
    "status" "TournamentStatus" NOT NULL DEFAULT 'REGISTRATION',
    "mode" "TournamentMode" NOT NULL DEFAULT 'ONLINE',
    "location" TEXT,
    "min_team_size" INTEGER NOT NULL,
    "max_team_size" INTEGER NOT NULL,
    "min_age" INTEGER,
    "max_age" INTEGER,
    "allowed_genders" JSONB,
    "registration_start_date" TIMESTAMP(3),
    "registration_deadline" TIMESTAMP(3),
    "auto_approve_teams" BOOLEAN NOT NULL DEFAULT false,
    "require_member_full_info" BOOLEAN NOT NULL DEFAULT true,
    "prize_pool" TEXT,
    "contact_email" TEXT,
    "contact_phone" TEXT,
    "contact_link" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "game_id" TEXT NOT NULL,
    "organizer_id" TEXT NOT NULL,

    CONSTRAINT "tournaments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tournament_favorites" (
    "user_id" TEXT NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tournament_favorites_pkey" PRIMARY KEY ("user_id","tournament_id")
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "order_index" INTEGER NOT NULL,
    "format" "RoundFormat" NOT NULL,
    "best_of" INTEGER NOT NULL DEFAULT 1,
    "settings" JSONB,
    "status" "RoundStatus" NOT NULL DEFAULT 'UPCOMING',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tournament_id" TEXT NOT NULL,

    CONSTRAINT "rounds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "round_teams" (
    "round_id" TEXT NOT NULL,
    "team_id" TEXT NOT NULL,
    "advanced_from_round_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "round_teams_pkey" PRIMARY KEY ("round_id","team_id")
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
    "short_name" TEXT,
    "description" TEXT,
    "logo_url" TEXT,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'PENDING',
    "seed" INTEGER,
    "final_rank" INTEGER,
    "contact_name" TEXT NOT NULL,
    "contact_email" TEXT NOT NULL,
    "contact_phone" TEXT,
    "reject_reason" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "registered_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "tournament_id" TEXT NOT NULL,
    "captain_id" TEXT NOT NULL,

    CONSTRAINT "teams_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "team_members" (
    "id" TEXT NOT NULL,
    "real_name" TEXT NOT NULL,
    "ign" TEXT NOT NULL,
    "in_game_id" TEXT,
    "birth_date" TIMESTAMP(3),
    "gender" "Gender",
    "email" TEXT,
    "phone_number" TEXT,
    "position" TEXT,
    "member_role" "MemberRole" NOT NULL DEFAULT 'PLAYER',
    "avatar_url" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
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
    "outcome" "MatchOutcome",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "activation_condition" "MatchActivationCondition",
    "bracket_type" "BracketType",
    "bracket_round" INTEGER,
    "match_number" INTEGER,
    "is_bye" BOOLEAN NOT NULL DEFAULT false,
    "best_of" INTEGER NOT NULL DEFAULT 1,
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
    "next_match_slot" "MatchSlot",
    "loser_next_match_id" TEXT,
    "loser_next_match_slot" "MatchSlot",

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
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "author_id" TEXT NOT NULL,
    "parent_id" TEXT,
    "reply_to_user_id" TEXT,
    "tournament_id" TEXT NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "content" TEXT NOT NULL,
    "data" JSONB,
    "deduplication_key" TEXT,
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
CREATE UNIQUE INDEX "users_google_subject_key" ON "users"("google_subject");

-- CreateIndex
CREATE UNIQUE INDEX "games_code_key" ON "games"("code");

-- CreateIndex
CREATE UNIQUE INDEX "games_name_key" ON "games"("name");

-- CreateIndex
CREATE UNIQUE INDEX "tournaments_slug_key" ON "tournaments"("slug");

-- CreateIndex
CREATE INDEX "tournaments_game_id_visibility_moderation_status_idx" ON "tournaments"("game_id", "visibility", "moderation_status");

-- CreateIndex
CREATE INDEX "tournaments_status_start_date_idx" ON "tournaments"("status", "start_date");

-- CreateIndex
CREATE INDEX "tournament_favorites_tournament_id_idx" ON "tournament_favorites"("tournament_id");

-- CreateIndex
CREATE INDEX "tournament_favorites_user_id_created_at_idx" ON "tournament_favorites"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "rounds_tournament_id_order_index_idx" ON "rounds"("tournament_id", "order_index");

-- CreateIndex
CREATE INDEX "round_teams_advanced_from_round_id_idx" ON "round_teams"("advanced_from_round_id");

-- CreateIndex
CREATE INDEX "round_teams_team_id_idx" ON "round_teams"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "round_teams_advanced_from_round_id_team_id_key" ON "round_teams"("advanced_from_round_id", "team_id");

-- CreateIndex
CREATE INDEX "groups_round_id_idx" ON "groups"("round_id");

-- CreateIndex
CREATE INDEX "teams_tournament_id_status_idx" ON "teams"("tournament_id", "status");

-- CreateIndex
CREATE INDEX "teams_captain_id_idx" ON "teams"("captain_id");

-- CreateIndex
CREATE UNIQUE INDEX "teams_tournament_id_name_key" ON "teams"("tournament_id", "name");

-- CreateIndex
CREATE INDEX "team_members_team_id_idx" ON "team_members"("team_id");

-- CreateIndex
CREATE UNIQUE INDEX "team_members_team_id_ign_key" ON "team_members"("team_id", "ign");

-- CreateIndex
CREATE INDEX "matches_round_id_group_id_idx" ON "matches"("round_id", "group_id");

-- CreateIndex
CREATE INDEX "matches_activation_condition_is_active_idx" ON "matches"("activation_condition", "is_active");

-- CreateIndex
CREATE INDEX "matches_team_a_id_team_b_id_idx" ON "matches"("team_a_id", "team_b_id");

-- CreateIndex
CREATE INDEX "match_scores_match_id_idx" ON "match_scores"("match_id");

-- CreateIndex
CREATE INDEX "comments_tournament_id_created_at_idx" ON "comments"("tournament_id", "created_at");

-- CreateIndex
CREATE INDEX "comments_parent_id_created_at_idx" ON "comments"("parent_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_deduplication_key_key" ON "notifications"("deduplication_key");

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
ALTER TABLE "tournament_favorites" ADD CONSTRAINT "tournament_favorites_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tournament_favorites" ADD CONSTRAINT "tournament_favorites_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rounds" ADD CONSTRAINT "rounds_tournament_id_fkey" FOREIGN KEY ("tournament_id") REFERENCES "tournaments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_teams" ADD CONSTRAINT "round_teams_round_id_fkey" FOREIGN KEY ("round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_teams" ADD CONSTRAINT "round_teams_team_id_fkey" FOREIGN KEY ("team_id") REFERENCES "teams"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "round_teams" ADD CONSTRAINT "round_teams_advanced_from_round_id_fkey" FOREIGN KEY ("advanced_from_round_id") REFERENCES "rounds"("id") ON DELETE CASCADE ON UPDATE CASCADE;

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
ALTER TABLE "comments" ADD CONSTRAINT "comments_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_reply_to_user_id_fkey" FOREIGN KEY ("reply_to_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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

-- AddCheckConstraint
ALTER TABLE "tournaments"
ADD CONSTRAINT "tournaments_roster_size_check"
CHECK ("max_team_size" >= "min_team_size");
