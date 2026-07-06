-- =============================================================================
-- SUPERSEDED — do NOT apply this file to Neon or any Prisma-managed database.
-- Use Prisma migration 20260623190000_postgis_geography instead.
--
-- This file is kept as a Docker reference only. It was originally written with
-- snake_case column names that do NOT match Prisma's generated schema (which
-- uses camelCase). The corrected column names are below.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── donor_profiles ──────────────────────────────────────────────────────────

ALTER TABLE donor_profiles
  ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326);

-- GIST index: O(log n) radius search
CREATE INDEX IF NOT EXISTS idx_donor_location
  ON donor_profiles USING GIST(location);

-- Covering index (camelCase — Prisma does NOT generate snake_case columns)
CREATE INDEX IF NOT EXISTS idx_donor_available_eligible
  ON donor_profiles ("isAvailable", "lastDonationDate" NULLS FIRST)
  INCLUDE (location, "userId");

-- ── blood_requests ──────────────────────────────────────────────────────────

ALTER TABLE blood_requests
  ADD COLUMN IF NOT EXISTS "hospitalLocation" GEOGRAPHY(POINT, 4326);

CREATE INDEX IF NOT EXISTS idx_request_hospital_location
  ON blood_requests USING GIST("hospitalLocation");

-- Partial index: only active requests
CREATE INDEX IF NOT EXISTS idx_request_active_expiry
  ON blood_requests ("expiresAt")
  WHERE status = 'PENDING';

-- ── audit_logs ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_month
  ON audit_logs (date_trunc('month', "createdAt"), "userId");
