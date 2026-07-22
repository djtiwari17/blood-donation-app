-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED');

-- AlterTable: blood_requests moderation columns.
-- Existing rows default to APPROVED so they stay visible in the donor feed.
ALTER TABLE "blood_requests"
    ADD COLUMN "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN "isVerified" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "isFake" BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN "rejectionReason" TEXT,
    ADD COLUMN "moderatedById" UUID,
    ADD COLUMN "moderatedAt" TIMESTAMPTZ;

-- CreateIndex
CREATE INDEX "blood_requests_moderationStatus_idx" ON "blood_requests"("moderationStatus");

-- AlterTable: users strike/flag columns
ALTER TABLE "users"
    ADD COLUMN "strikeCount" INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN "isFlagged" BOOLEAN NOT NULL DEFAULT false;
