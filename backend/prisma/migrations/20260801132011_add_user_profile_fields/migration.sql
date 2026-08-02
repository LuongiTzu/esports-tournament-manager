-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "bio" TEXT,
ADD COLUMN     "birth_date" TIMESTAMP(3),
ADD COLUMN     "current_address" TEXT,
ADD COLUMN     "gender" "Gender",
ADD COLUMN     "phone_number" TEXT;
