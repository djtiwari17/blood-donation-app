-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "postgis";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "BloodGroup" AS ENUM ('A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-');

-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('DONOR', 'RECEIVER', 'DONOR_RECEIVER', 'ADMIN', 'SUPER_ADMIN');

-- CreateEnum
CREATE TYPE "VerifStatus" AS ENUM ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "UrgencyLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('PENDING', 'PARTIALLY_FULFILLED', 'FULFILLED', 'EXPIRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MatchStatus" AS ENUM ('NOTIFIED', 'ACCEPTED', 'DONATED', 'CANCELLED', 'TIMED_OUT');

-- CreateEnum
CREATE TYPE "SmsProvider" AS ENUM ('CONSOLE', 'MSG91', 'TWILIO', 'FIREBASE');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('FAKE_PROFILE', 'SPAM', 'HARASSMENT', 'WRONG_INFO', 'OTHER');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "phone" VARCHAR(15) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255),
    "bloodGroup" "BloodGroup" NOT NULL,
    "gender" "Gender",
    "dateOfBirth" DATE,
    "city" VARCHAR(100),
    "area" VARCHAR(100),
    "role" "UserRole" NOT NULL DEFAULT 'DONOR',
    "fcmToken" VARCHAR(500),
    "isBlocked" BOOLEAN NOT NULL DEFAULT false,
    "verifStatus" "VerifStatus" NOT NULL DEFAULT 'UNVERIFIED',
    "reportCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMPTZ,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donor_profiles" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "lastDonationDate" DATE,
    "locationLat" DOUBLE PRECISION,
    "locationLng" DOUBLE PRECISION,
    "totalDonations" INTEGER NOT NULL DEFAULT 0,
    "livesSaved" INTEGER NOT NULL DEFAULT 0,
    "responseRate" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "donor_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_requests" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "requestCode" VARCHAR(12) NOT NULL,
    "receiverId" UUID NOT NULL,
    "patientName" VARCHAR(100) NOT NULL,
    "hospitalName" VARCHAR(200) NOT NULL,
    "hospitalLat" DOUBLE PRECISION,
    "hospitalLng" DOUBLE PRECISION,
    "bloodGroup" "BloodGroup" NOT NULL,
    "unitsNeeded" INTEGER NOT NULL,
    "unitsFulfilled" INTEGER NOT NULL DEFAULT 0,
    "urgency" "UrgencyLevel" NOT NULL,
    "requiredBy" TIMESTAMPTZ NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blood_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blood_matches" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "requestId" UUID NOT NULL,
    "donorProfileId" UUID NOT NULL,
    "status" "MatchStatus" NOT NULL DEFAULT 'NOTIFIED',
    "distanceKm" DOUBLE PRECISION NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "notifiedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "respondedAt" TIMESTAMPTZ,
    "donatedAt" TIMESTAMPTZ,
    "timeoutAt" TIMESTAMPTZ NOT NULL,
    "cancelReason" TEXT,

    CONSTRAINT "blood_matches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_verifs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID,
    "phone" VARCHAR(15) NOT NULL,
    "provider" "SmsProvider" NOT NULL,
    "sentAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedAt" TIMESTAMPTZ,

    CONSTRAINT "otp_verifs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "userId" UUID NOT NULL,
    "tokenHash" VARCHAR(128) NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "revokedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID NOT NULL,
    "type" VARCHAR(50) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "relatedId" UUID,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "reporterId" UUID NOT NULL,
    "reportedId" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" TEXT,
    "resolvedAt" TIMESTAMPTZ,
    "resolution" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "geocode_cache" (
    "id" TEXT NOT NULL,
    "query" VARCHAR(500) NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lng" DOUBLE PRECISION NOT NULL,
    "displayName" TEXT NOT NULL,
    "cachedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "geocode_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL DEFAULT uuid_generate_v4(),
    "userId" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(50),
    "entityId" UUID,
    "meta" JSONB,
    "ipAddress" VARCHAR(45),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_bloodGroup_idx" ON "users"("bloodGroup");

-- CreateIndex
CREATE INDEX "users_verifStatus_idx" ON "users"("verifStatus");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "donor_profiles_userId_key" ON "donor_profiles"("userId");

-- CreateIndex
CREATE INDEX "donor_profiles_isAvailable_idx" ON "donor_profiles"("isAvailable");

-- CreateIndex
CREATE UNIQUE INDEX "blood_requests_requestCode_key" ON "blood_requests"("requestCode");

-- CreateIndex
CREATE INDEX "blood_requests_status_urgency_idx" ON "blood_requests"("status", "urgency");

-- CreateIndex
CREATE INDEX "blood_requests_bloodGroup_status_idx" ON "blood_requests"("bloodGroup", "status");

-- CreateIndex
CREATE INDEX "blood_requests_expiresAt_idx" ON "blood_requests"("expiresAt");

-- CreateIndex
CREATE INDEX "blood_matches_status_timeoutAt_idx" ON "blood_matches"("status", "timeoutAt");

-- CreateIndex
CREATE UNIQUE INDEX "blood_matches_requestId_donorProfileId_key" ON "blood_matches"("requestId", "donorProfileId");

-- CreateIndex
CREATE INDEX "otp_verifs_phone_sentAt_idx" ON "otp_verifs"("phone", "sentAt");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "notifications"("createdAt");

-- CreateIndex
CREATE INDEX "reports_reportedId_resolvedAt_idx" ON "reports"("reportedId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporterId_reportedId_key" ON "reports"("reporterId", "reportedId");

-- CreateIndex
CREATE UNIQUE INDEX "geocode_cache_query_key" ON "geocode_cache"("query");

-- CreateIndex
CREATE INDEX "geocode_cache_cachedAt_idx" ON "geocode_cache"("cachedAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_createdAt_idx" ON "audit_logs"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "donor_profiles" ADD CONSTRAINT "donor_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_requests" ADD CONSTRAINT "blood_requests_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_matches" ADD CONSTRAINT "blood_matches_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "blood_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blood_matches" ADD CONSTRAINT "blood_matches_donorProfileId_fkey" FOREIGN KEY ("donorProfileId") REFERENCES "donor_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_verifs" ADD CONSTRAINT "otp_verifs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
