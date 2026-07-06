-- =============================================================================
-- PostGIS geography columns, GIST indexes, sync triggers, nextEligibleDate
-- Prisma cannot model GEOGRAPHY types, so these are added via raw migration.
-- Column names are camelCase — matching Prisma's generated init migration.
-- NOTE: The older prisma/migrations/0001_postgis_setup.sql referenced
-- incorrect snake_case column names; this migration supersedes it for Neon.
-- =============================================================================

-- ─── donor_profiles ──────────────────────────────────────────────────────────

-- 1. Add geography column
ALTER TABLE donor_profiles
  ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326);

-- 2. Backfill from existing lat/lng rows
--    IMPORTANT: ST_MakePoint takes (longitude, latitude) — NOT (lat, lng)
UPDATE donor_profiles
  SET location = ST_SetSRID(
    ST_MakePoint("locationLng", "locationLat"),
    4326
  )::geography
  WHERE "locationLat" IS NOT NULL
    AND "locationLng" IS NOT NULL;

-- 3. GIST index — enables O(log n) ST_DWithin radius search
CREATE INDEX IF NOT EXISTS idx_donor_location
  ON donor_profiles USING GIST(location);

-- 4. B-tree covering index for the matching hot path
--    (avoids heap fetch for isAvailable + lastDonationDate filter)
CREATE INDEX IF NOT EXISTS idx_donor_available_eligible
  ON donor_profiles ("isAvailable", "lastDonationDate" NULLS FIRST)
  INCLUDE (location, "userId");

-- 5. Sync trigger: keeps geography in sync whenever lat/lng are written
CREATE OR REPLACE FUNCTION donor_profiles_sync_location()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."locationLat" IS NOT NULL AND NEW."locationLng" IS NOT NULL THEN
    NEW.location := ST_SetSRID(
      ST_MakePoint(NEW."locationLng", NEW."locationLat"),
      4326
    )::geography;
  ELSE
    NEW.location := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_donor_profiles_sync_location ON donor_profiles;
CREATE TRIGGER trg_donor_profiles_sync_location
  BEFORE INSERT OR UPDATE OF "locationLat", "locationLng"
  ON donor_profiles
  FOR EACH ROW EXECUTE FUNCTION donor_profiles_sync_location();

-- 6. nextEligibleDate: stored generated column (56-day donation window)
--    Visible in raw SQL and admin queries; not in Prisma schema (safe — Prisma
--    selects named fields only, never SELECT *)
ALTER TABLE donor_profiles
  ADD COLUMN IF NOT EXISTS "nextEligibleDate" DATE
  GENERATED ALWAYS AS ("lastDonationDate" + INTERVAL '56 days') STORED;

-- ─── blood_requests ───────────────────────────────────────────────────────────

-- 7. Add geography column for hospital location
ALTER TABLE blood_requests
  ADD COLUMN IF NOT EXISTS "hospitalLocation" GEOGRAPHY(POINT, 4326);

-- 8. Backfill (longitude FIRST)
UPDATE blood_requests
  SET "hospitalLocation" = ST_SetSRID(
    ST_MakePoint("hospitalLng", "hospitalLat"),
    4326
  )::geography
  WHERE "hospitalLat" IS NOT NULL
    AND "hospitalLng" IS NOT NULL;

-- 9. GIST index for reverse-lookup (find requests near a donor)
CREATE INDEX IF NOT EXISTS idx_request_hospital_location
  ON blood_requests USING GIST("hospitalLocation");

-- 10. Partial index: only PENDING requests enter the matching hot path
CREATE INDEX IF NOT EXISTS idx_request_active_expiry
  ON blood_requests ("expiresAt")
  WHERE status = 'PENDING';

-- 11. Sync trigger for blood_requests
CREATE OR REPLACE FUNCTION blood_requests_sync_location()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."hospitalLat" IS NOT NULL AND NEW."hospitalLng" IS NOT NULL THEN
    NEW."hospitalLocation" := ST_SetSRID(
      ST_MakePoint(NEW."hospitalLng", NEW."hospitalLat"),
      4326
    )::geography;
  ELSE
    NEW."hospitalLocation" := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_blood_requests_sync_location ON blood_requests;
CREATE TRIGGER trg_blood_requests_sync_location
  BEFORE INSERT OR UPDATE OF "hospitalLat", "hospitalLng"
  ON blood_requests
  FOR EACH ROW EXECUTE FUNCTION blood_requests_sync_location();
