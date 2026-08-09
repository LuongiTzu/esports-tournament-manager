-- AlterTable
ALTER TABLE "matches" ADD COLUMN     "best_of" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "is_bye" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "rounds" ADD COLUMN     "best_of" INTEGER NOT NULL DEFAULT 1;
