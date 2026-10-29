-- AlterTable
ALTER TABLE "child_game_progress" ADD COLUMN     "best_stars" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "children" ADD COLUMN     "total_stars" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "game_sessions" ADD COLUMN     "stars_earned" INTEGER NOT NULL DEFAULT 0;
