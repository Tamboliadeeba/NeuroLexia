-- CreateEnum
CREATE TYPE "Language" AS ENUM ('en', 'hi');

-- CreateEnum
CREATE TYPE "FontPreference" AS ENUM ('opendyslexic', 'atkinson', 'default');

-- CreateEnum
CREATE TYPE "GameType" AS ENUM ('trip_to_space', 'echo_galaxy', 'astrotales', 'word_orbit', 'math_mission');

-- CreateEnum
CREATE TYPE "UnlockType" AS ENUM ('planet', 'theme');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "preferred_language" "Language" NOT NULL DEFAULT 'en',
    "override_pin_hash" TEXT,
    "consent_given_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "characters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "sprite_svg" TEXT NOT NULL,
    "tts_voice_hint" TEXT NOT NULL,
    "description_en" TEXT NOT NULL,
    "description_hi" TEXT NOT NULL,

    CONSTRAINT "characters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "children" (
    "id" TEXT NOT NULL,
    "parent_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER NOT NULL,
    "username" TEXT,
    "password_hash" TEXT,
    "preferred_language" "Language" NOT NULL DEFAULT 'en',
    "character_id" TEXT,
    "preferred_font" "FontPreference" NOT NULL DEFAULT 'opendyslexic',
    "total_points" INTEGER NOT NULL DEFAULT 0,
    "points_balance" INTEGER NOT NULL DEFAULT 0,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "children_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_credentials" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "credential_id" BYTEA NOT NULL,
    "public_key" BYTEA NOT NULL,
    "counter" BIGINT NOT NULL,
    "transports" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "child_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webauthn_challenges" (
    "id" TEXT NOT NULL,
    "child_id" TEXT,
    "challenge" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webauthn_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_sessions" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "game_type" "GameType" NOT NULL,
    "client_session_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "ended_at" TIMESTAMP(3) NOT NULL,
    "level" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "points_earned" INTEGER NOT NULL DEFAULT 0,
    "accuracy" DOUBLE PRECISION,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '{}',
    "self_reported_count" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "game_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_game_progress" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "game_type" "GameType" NOT NULL,
    "current_level" INTEGER NOT NULL DEFAULT 1,
    "phase" INTEGER NOT NULL DEFAULT 1,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_game_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unlocks" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "unlock_type" "UnlockType" NOT NULL,
    "unlock_key" TEXT NOT NULL,
    "unlocked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "unlocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_reports" (
    "id" TEXT NOT NULL,
    "child_id" TEXT NOT NULL,
    "parent_id" TEXT NOT NULL,
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "language" "Language" NOT NULL,
    "report_text" TEXT NOT NULL,
    "summary" TEXT,
    "weak_areas" TEXT,
    "activities" TEXT,
    "prompt_used" TEXT NOT NULL,
    "is_mock" BOOLEAN NOT NULL DEFAULT false,
    "model_id" TEXT,

    CONSTRAINT "ai_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "characters_key_key" ON "characters"("key");

-- CreateIndex
CREATE UNIQUE INDEX "children_username_key" ON "children"("username");

-- CreateIndex
CREATE UNIQUE INDEX "child_credentials_credential_id_key" ON "child_credentials"("credential_id");

-- CreateIndex
CREATE UNIQUE INDEX "game_sessions_child_id_client_session_id_key" ON "game_sessions"("child_id", "client_session_id");

-- CreateIndex
CREATE UNIQUE INDEX "child_game_progress_child_id_game_type_key" ON "child_game_progress"("child_id", "game_type");

-- CreateIndex
CREATE UNIQUE INDEX "unlocks_child_id_unlock_key_key" ON "unlocks"("child_id", "unlock_key");

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "children" ADD CONSTRAINT "children_character_id_fkey" FOREIGN KEY ("character_id") REFERENCES "characters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_credentials" ADD CONSTRAINT "child_credentials_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webauthn_challenges" ADD CONSTRAINT "webauthn_challenges_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "game_sessions" ADD CONSTRAINT "game_sessions_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_game_progress" ADD CONSTRAINT "child_game_progress_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unlocks" ADD CONSTRAINT "unlocks_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_reports" ADD CONSTRAINT "ai_reports_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
