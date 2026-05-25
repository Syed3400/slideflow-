-- CreateEnum
CREATE TYPE "PresentationStatus" AS ENUM ('PENDING', 'PROCESSING', 'PARSED', 'ERROR');

-- AlterTable
ALTER TABLE "Presentation"
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" TYPE "PresentationStatus"
USING ("status"::"PresentationStatus"),
ALTER COLUMN "status" SET DEFAULT 'PENDING';
