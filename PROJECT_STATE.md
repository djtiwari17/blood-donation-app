# Blood Donation App — Project State Document
> Generated: 2026-06-12 | Updated: 2026-06-17 | Session handoff document

---

## 1. Overall Architecture & Tech Stack

### Monorepo Layout
```
blood-donation/                   <- npm workspaces root
├── apps/
│   ├── backend/                  <- NestJS REST API + WebSocket gateway
│   ├── mobile/                   <- Expo SDK 54 React Native app
│   └── admin/                    <- Vite + React + Ant Design web portal (Phase 7)
├── packages/
│   └── types/                    <- Shared TypeScript types (no framework deps)
└── prisma/                       <- Schema, migrations, seed script
```

### Tech Stack (Budget Stack — overrides Blueprint defaults)

| Layer | Technology | Notes |
|---|---|---|
| **Mobile** | React Native + Expo SDK 54 + TypeScript | expo-location, expo-secure-store, expo-notifications |
| **State** | Zustand + @tanstack/react-query | SecureStore-backed token persistence |
| **HTTP** | Axios + auto-refresh interceptor | 401 → refresh → retry with request queue |
| **Backend** | NestJS 10 + TypeScript | Modular, global filters/interceptors, RS256 JWT |
| **ORM** | Prisma 5 + raw SQL for PostGIS | GEOGRAPHY columns handled via `$executeRaw` |
| **Database** | PostgreSQL 16 + PostGIS 3.4 | Neon or Supabase (PITR backups); GIST indexes |
| **Cache / Queue** | Redis 7 / Upstash | OTP store, sessions, rate counters, BullMQ |
| **Queue** | BullMQ + @nestjs/bullmq | Matching engine, notification dispatch, cron |
| **SMS** | MSG91 → Twilio → Console (chain) | `ISmsProvider` interface; ConsoleSms in dev |
| **Maps** | OpenStreetMap + Nominatim | Cached in `geocode_cache` table; zero Google |
| **Storage** | Cloudflare R2 (Phase 8) | S3-compatible SDK |
| **Push** | Firebase Cloud Messaging | Phase 5 |
| **Email** | SendGrid / Resend free tier | Phase 5 |
| **Monitoring** | Sentry + Grafana Cloud free | Phase 8 |
| **Hosting** | Railway or Render | `railway.json` + `render.yaml` both present |
| **CI/CD** | GitHub Actions | lint → unit → e2e → build → deploy |
| **Admin** | Vite 5 + React 18 + Ant Design 5 | Phase 7 |

### Performance Guarantees (must not regress)
- API p95 < 300 ms; geo-search p95 < 500 ms at 50 km radius
- GIST index on `donor_profiles.location` + covering index on `(is_available, last_donation_date)`
- 30-second nearby-request cache in Redis (Phase 4)
- OTP: bcrypt cost 10, Redis TTL 300 s, 3 attempts, 30-min lockout
- JWT: RS256, access 15 min, refresh 7 days with DB rotation + reuse detection
- Phone masking until `match.status = ACCEPTED` (M-03)
- Radius escalation: STANDARD 10→25→50→100→200 km; CRITICAL starts at 50 km → 200 km at T+30min (Blueprint §4.2)

---

## 2. Completed Phases

### Phase 0 — Monorepo Scaffold ✅
**What was built:**
- npm workspaces root `package.json`
- `.gitignore`, `.env.example` (all vars documented with inline comments)
- `docker-compose.yml`: 4 services (db: postgis/postgis:16-3.4, redis:7-alpine, api, worker) with health checks
- `railway.json` + `render.yaml` for cloud deployment
- `.github/workflows/ci.yml`: backend lint → unit → e2e → build; mobile typecheck; staging/prod deploy gates
- `prisma/init.sql`: enables `postgis` + `uuid-ossp` extensions
- `prisma/schema.prisma`: full production schema (10 tables, 8 enums — see §4)
- `prisma/migrations/0001_postgis_setup.sql`: adds GEOGRAPHY columns + GIST indexes post-Prisma-migrate
- `prisma/seed.ts`: dev-only seeder guarded by `NODE_ENV=development` + localhost URL check
- Full NestJS scaffold: `app.module.ts`, `main.ts` (helmet, compression, CORS, ValidationPipe, global prefix `v1`)
- Global infrastructure: `GlobalExceptionFilter`, `ResponseInterceptor` (`{ success, data }`), `LoggingInterceptor` (redacts sensitive fields)
- `PrismaService` with soft-delete middleware (excludes `deletedAt` records)
- `RedisService` (ioredis, exponential backoff retry)
- `HealthModule`: `GET /health` → `{ status, db, redis, timestamp, version, uptime }`
- Mobile moved to `apps/mobile/`, metro.config.js updated for monorepo, new deps added
- `packages/types/src/index.ts`: shared enums, DTOs, `BLOOD_COMPATIBILITY` matrix, constants
- `apps/admin/`: Vite scaffold (placeholder, Phase 7)

**Quality gate:** `docker compose up` → all 4 services healthy; `curl /health` → `{ status: "ok" }`

---

### Phase 2 — Auth Module ✅
**What was built (17 backend files, 5 mobile files):**

#### Backend
- **SMS provider chain** (`src/modules/sms/`):
  - `ISmsProvider` interface
  - `ConsoleSmsProvider` — logs to stdout, zero real SMS in dev
  - `Msg91SmsProvider` — DLT-compliant, 6 s timeout
  - `TwilioSmsProvider` — fallback, 8 s timeout, form-urlencoded
  - `ChainSmsProvider` — tries MSG91 → Twilio → Console in order per `SMS_PROVIDER` env
- **Auth flow** (`src/modules/auth/`):
  - `POST /v1/auth/send-otp` — rate limit 5/hr per phone (Redis `incr/expire`); bcrypt-hash OTP (cost 10); store `otp:{phone}` with 300 s TTL; send via SMS chain
  - `POST /v1/auth/verify-otp` — lockout check (`otp:lock:{phone}` = 1800 s); bcrypt.compare; 3 attempts then lock; on pass: if new user → `{ isNewUser: true, otpSession }` (15-min JWT + Redis `otp:pending:{phone}` 900 s); if existing → issue access+refresh tokens
  - `POST /v1/auth/register` — verifies otpSession JWT (`type=otp_session`), checks Redis pending flag, creates User with blood group (BG_MAP display→Prisma enum), clears pending, issues token pair
  - `POST /v1/auth/refresh` — verifies refresh JWT; looks up DB record by jti; SHA256 hash comparison; reuse detection (revokes ALL tokens on mismatch); rotates token pair
  - `POST /v1/auth/logout` — soft-revokes all refresh tokens for user
- **JWT RS256**: `JwtAccessStrategy` (Bearer header) + `JwtRefreshStrategy` (body field); `JwtAuthGuard` + `@Public()` decorator
- **Global throttler**: `ThrottlerModule` 100 req/min baseline via `APP_GUARD`
- **Unit tests** (`auth.service.spec.ts`): 8 tests covering sendOtp rate limit, verifyOtp lockout/wrong-OTP/3-strikes/new-user/existing-user, OTP policy constants

#### Mobile
- `src/constants/api.ts` — `EXPO_PUBLIC_API_URL` with localhost default
- `src/api/client.ts` — Axios instance + 401-interceptor with concurrent-request queue during refresh
- `src/api/auth.api.ts` — typed wrappers: sendOtp, verifyOtp, register, refresh, logout
- `src/store/auth.store.ts` — Zustand: user, isAuthenticated, isLoading, otpSession, registrationTokens; SecureStore persistence
- `LoginScreen.tsx` — real `sendOtp` call, 429 → Alert
- `OTPScreen.tsx` — real `verifyOtp`; routes new vs existing users
- `RoleSelectionScreen.tsx` — calls `register`; DONOR → `setRegistrationTokens` + navigate to DonorProfileSetup; RECEIVER → `setAuth` immediately

**Quality gate:** 8 unit tests passing; auth flow covers send→verify→register→refresh→logout

---

### Phase 3 — Users, Donors, Geolocation ✅
**What was built (11 backend files, 5 mobile files):**

#### Backend
- **GeocodingService** (`src/modules/geocoding/`):
  - Forward geocode: address → lat/lng (Nominatim `/search`, India-filtered)
  - Reverse geocode: lat/lng → area name (Nominatim `/reverse`)
  - Postgres cache via `geocode_cache` table (never double-hits Nominatim)
  - 1.1 s throttle between requests (Nominatim ToS compliance)
  - `User-Agent: BloodDonationApp/1.0`
- **UsersModule** (`src/modules/users/`):
  - `GET /v1/users/me` — returns user + donorProfile, strips `deletedAt`
  - `PATCH /v1/users/me` — updates name, city, area, fcmToken, gender, dateOfBirth
- **DonorsModule** (`src/modules/donors/`):
  - `POST /v1/donors/profile` — creates donor profile; updates User gender/dob; sets PostGIS GEOGRAPHY via `$executeRaw`; auto reverse-geocodes `area`; returns profile with eligibility
  - `GET /v1/donors/profile` — returns profile enriched with `isEligible` + `nextEligibleDate`
  - `PATCH /v1/donors/profile` — updates availability/location/lastDonationDate; re-geocodes area on location change
  - **56-day eligibility rule**: `isEligible(lastDonationDate)` → days since ≥ 56; `nextEligibleDate` → lastDonation + 56 days
- **Unit tests** (`donors.service.spec.ts`): 10 tests covering all eligibility edge cases (null, 0, 30, 55, 56, 100 days), nextEligibleDate, createProfile conflict + success, getProfile not-found + eligibility enrichment

#### Mobile
- `auth.store.ts` — added `registrationTokens: { accessToken, refreshToken, user }` for two-step donor onboarding
- `src/api/users.api.ts` — getMe, updateMe
- `src/api/donors.api.ts` — getProfile, updateProfile, `createProfileWithToken(payload, token)` (bypasses interceptor for pre-auth call)
- `DonorProfileSetupScreen.tsx` — `expo-location` GPS request (graceful deny), `parseDob()` for DD/MM/YYYY, calls `createProfileWithToken`, then `setAuth()` to enter app
- `DonorDashboardScreen.tsx` — user data from Zustand store; nearby requests still mock (Phase 4)
- `RootNavigator.tsx` — Zustand-based routing; auto-fetches `/users/me` on app start; spinner during `isLoading`

**Quality gate:** 10 unit tests; GEOGRAPHY column + GIST index set on profile create; Nominatim cache hit verified

---

## 3. Current File Structure

```
blood-donation/
├── .env.example                          <- all env vars documented
├── .gitignore
├── .github/
│   └── workflows/ci.yml                  <- lint->unit->e2e->build->deploy
├── docker-compose.yml                    <- db, redis, api, worker
├── railway.json
├── render.yaml
├── package.json                          <- workspace root
│
├── prisma/
│   ├── init.sql                          <- CREATE EXTENSION postgis, uuid-ossp
│   ├── schema.prisma                     <- full production schema
│   ├── seed.ts                           <- dev-only, localhost-guarded
│   └── migrations/
│       └── 0001_postgis_setup.sql        <- GEOGRAPHY cols + GIST indexes
│
├── packages/
│   └── types/
│       ├── package.json
│       ├── tsconfig.json
│       └── src/index.ts                  <- BloodGroup, VerifStatus, DTOs,
│                                            BLOOD_COMPATIBILITY matrix, constants
│
├── apps/
│   ├── backend/
│   │   ├── Dockerfile                    <- base/development/builder/production stages
│   │   ├── nest-cli.json
│   │   ├── package.json                  <- all NestJS + Prisma + BullMQ deps
│   │   ├── tsconfig.json / tsconfig.build.json
│   │   ├── test/jest-e2e.json
│   │   └── src/
│   │       ├── app.module.ts             <- Config, Throttler, Redis, Database, Sms,
│   │       │                                Health, Auth, Geocoding, Users, Donors
│   │       ├── main.ts                   <- bootstrap (helmet, cors, validation, prefix v1)
│   │       ├── config/
│   │       │   └── app.config.ts         <- Joi validation schema + registerAs('app')
│   │       ├── database/
│   │       │   ├── database.module.ts    <- @Global(), exports PrismaService
│   │       │   └── prisma.service.ts     <- soft-delete middleware, isHealthy()
│   │       ├── redis/
│   │       │   ├── redis.module.ts       <- @Global()
│   │       │   └── redis.service.ts      <- ioredis, exponential backoff, isHealthy()
│   │       ├── common/
│   │       │   ├── filters/global-exception.filter.ts
│   │       │   └── interceptors/
│   │       │       ├── response.interceptor.ts    <- wraps in { success, data }
│   │       │       └── logging.interceptor.ts     <- redacts sensitive fields
│   │       └── modules/
│   │           ├── health/
│   │           │   ├── health.module.ts
│   │           │   └── health.controller.ts       <- GET /health
│   │           ├── sms/
│   │           │   ├── sms.module.ts              <- @Global()
│   │           │   ├── interfaces/sms-provider.interface.ts
│   │           │   └── providers/
│   │           │       ├── console.provider.ts
│   │           │       ├── msg91.provider.ts
│   │           │       ├── twilio.provider.ts
│   │           │       └── chain.provider.ts      <- MSG91->Twilio->Console
│   │           ├── auth/
│   │           │   ├── auth.module.ts
│   │           │   ├── auth.controller.ts         <- 5 endpoints
│   │           │   ├── auth.service.ts            <- OTP + JWT + token rotation
│   │           │   ├── auth.service.spec.ts       <- 8 unit tests
│   │           │   ├── decorators/
│   │           │   │   ├── current-user.decorator.ts
│   │           │   │   └── public.decorator.ts
│   │           │   ├── dto/
│   │           │   │   ├── send-otp.dto.ts
│   │           │   │   ├── verify-otp.dto.ts
│   │           │   │   └── register.dto.ts
│   │           │   ├── guards/
│   │           │   │   ├── jwt-auth.guard.ts
│   │           │   │   └── jwt-refresh.guard.ts
│   │           │   └── strategies/
│   │           │       ├── jwt-access.strategy.ts
│   │           │       └── jwt-refresh.strategy.ts
│   │           ├── geocoding/
│   │           │   ├── geocoding.module.ts        <- @Global()
│   │           │   └── geocoding.service.ts       <- Nominatim + Postgres cache
│   │           ├── users/
│   │           │   ├── users.module.ts
│   │           │   ├── users.controller.ts        <- GET/PATCH /users/me
│   │           │   ├── users.service.ts
│   │           │   └── dto/update-user.dto.ts
│   │           └── donors/
│   │               ├── donors.module.ts
│   │               ├── donors.controller.ts       <- POST/GET/PATCH /donors/profile
│   │               ├── donors.service.ts          <- 56-day eligibility
│   │               ├── donors.service.spec.ts     <- 10 unit tests
│   │               └── dto/
│   │                   ├── create-donor-profile.dto.ts
│   │                   └── update-donor-profile.dto.ts
│   │
│   │   ├── test/
│   │   │   ├── jest-e2e.json
│   │   │   ├── jest-integration.json             <- picks up .integration.ts + .e2e-spec.ts
│   │   │   ├── e2e/
│   │   │   │   ├── donor-journey.e2e-spec.ts     <- full auth+donate flow; skips without DB/Redis
│   │   │   │   ├── security.e2e-spec.ts          <- rate limits, JWT tamper, RBAC, phone masking
│   │   │   │   └── trust-safety.e2e-spec.ts      <- 3-report suspend, match cancel, self-report
│   │   │   └── k6/
│   │   │       └── geo-search.k6.js              <- 50 VUs 60s; p95<500ms geo, p95<300ms hot read
│   │   │
│   │   │   [NEW FILES — test pass 2026-06-17]
│   │   ├── src/modules/matching/matching.utils.ts <- BLOOD_COMPATIBILITY, STANDARD_ESCALATION,
│   │   │                                             CRITICAL_ESCALATION, scoreMatch, EscalationStage
│   │   ├── src/modules/matching/matching.service.spec.ts <- 67 unit tests
│   │   ├── src/modules/matching/matching.scheduler.spec.ts <- 9 unit tests
│   │   ├── src/modules/requests/requests.service.spec.ts  <- 33 unit tests
│   │   ├── src/modules/reports/reports.service.spec.ts    <- 24 unit tests
│   │   │
│   │   ├── docs/test-report.md                   <- before/after metrics, FR/BR/EC coverage
│   │   └── docs/pre-launch-signoff.md            <- 8-week action plan, DLT critical path
│   │
│   ├── mobile/
│   │   ├── .env.example                  <- EXPO_PUBLIC_API_URL
│   │   ├── App.tsx                       <- SafeAreaProvider + AppProvider + RootNavigator
│   │   ├── app.json
│   │   ├── babel.config.js
│   │   ├── metro.config.js               <- monorepo-aware (watchFolders + nodeModulesPaths)
│   │   ├── package.json
│   │   ├── tsconfig.json                 <- paths: @/* -> src/*, @blood-donation/types
│   │   └── src/
│   │       ├── api/
│   │       │   ├── client.ts             <- Axios + 401 refresh interceptor + queue
│   │       │   ├── auth.api.ts
│   │       │   ├── users.api.ts
│   │       │   └── donors.api.ts         <- createProfileWithToken for pre-auth call
│   │       ├── constants/
│   │       │   └── api.ts                <- API_URL from EXPO_PUBLIC_API_URL
│   │       ├── store/
│   │       │   └── auth.store.ts         <- Zustand: user, isAuthenticated, registrationTokens
│   │       ├── context/
│   │       │   └── AppContext.tsx        <- legacy mock context (removed Phase 8)
│   │       ├── navigation/
│   │       │   ├── types.ts              <- all stack param lists
│   │       │   ├── RootNavigator.tsx     <- Zustand-based routing + token-load on start
│   │       │   ├── AuthNavigator.tsx
│   │       │   ├── DonorNavigator.tsx
│   │       │   └── ReceiverNavigator.tsx
│   │       ├── screens/
│   │       │   ├── auth/
│   │       │   │   ├── LoginScreen.tsx          [REAL API]
│   │       │   │   ├── OTPScreen.tsx            [REAL API]
│   │       │   │   ├── RegistrationScreen.tsx   <- collects name/bloodGroup/city
│   │       │   │   ├── RoleSelectionScreen.tsx  [REAL API - register]
│   │       │   │   ├── DonorProfileSetupScreen.tsx [REAL API + expo-location]
│   │       │   │   └── SplashScreen.tsx
│   │       │   ├── donor/
│   │       │   │   ├── DonorDashboardScreen.tsx [REAL API - Phase 4]
│   │       │   │   ├── DonorProfileScreen.tsx   [REAL API - Phase 8]
│   │       │   │   ├── NearbyRequestsScreen.tsx [REAL API - Phase 4]
│   │       │   │   ├── RequestDetailsScreen.tsx [REAL API - Phase 6]
│   │       │   │   └── DonationHistoryScreen.tsx[REAL API - Phase 8]
│   │       │   ├── receiver/
│   │       │   │   ├── ReceiverDashboardScreen.tsx  [REAL API - Phase 8]
│   │       │   │   ├── CreateRequestScreen.tsx      [REAL API - Phase 4]
│   │       │   │   ├── MatchingDonorsScreen.tsx     [REAL API - Phase 4]
│   │       │   │   ├── RequestStatusScreen.tsx      [REAL API - Phase 4]
│   │       │   │   ├── RequestSubmittedScreen.tsx   [navigation only]
│   │       │   │   └── ReceiverProfileScreen.tsx    [REAL API - Phase 8]
│   │       │   └── common/
│   │       │       ├── NotificationsScreen.tsx  [REAL API - Phase 5]
│   │       │       ├── ReportUserScreen.tsx     [REAL API - Phase 6]
│   │       │       └── VerificationPendingScreen.tsx
│   │       ├── mockData/                 <- removed Phase 8
│   │       ├── components/               <- Avatar, Badge, Button, Card, Header, Input, SelectPicker
│   │       ├── theme/index.ts
│   │       ├── types/index.ts            <- legacy types
│   │       └── utils/helpers.ts
│   │
│   └── admin/
│       ├── package.json                  <- @blood-donation/admin, Vite + Ant Design
│       ├── index.html
│       ├── tsconfig.json
│       ├── vite.config.ts               <- proxy /v1 -> localhost:3000
│       └── src/main.tsx                 <- placeholder "Phase 7 - Coming Soon"
```

---

## 4. Database Schema (Prisma + PostGIS)

### Enums
```
BloodGroup:    A_POS A_NEG B_POS B_NEG AB_POS AB_NEG O_POS O_NEG  (@map: "A+" "A-" etc.)
Gender:        MALE FEMALE OTHER
UserRole:      DONOR RECEIVER DONOR_RECEIVER ADMIN SUPER_ADMIN
VerifStatus:   UNVERIFIED PENDING VERIFIED REJECTED SUSPENDED
UrgencyLevel:  LOW MEDIUM HIGH CRITICAL
RequestStatus: PENDING PARTIALLY_FULFILLED FULFILLED EXPIRED CANCELLED
MatchStatus:   NOTIFIED ACCEPTED DONATED CANCELLED TIMED_OUT
SmsProvider:   CONSOLE MSG91 TWILIO FIREBASE
ReportReason:  FAKE_PROFILE SPAM HARASSMENT WRONG_INFO OTHER
```

### Table: users
| Column | Type | Notes |
|---|---|---|
| id | UUID | uuid_generate_v4() |
| phone | VARCHAR(15) UNIQUE | |
| name | VARCHAR(100) | |
| email | VARCHAR(255) UNIQUE nullable | |
| blood_group | BloodGroup | |
| gender | Gender nullable | |
| date_of_birth | DATE nullable | |
| city | VARCHAR(100) nullable | |
| area | VARCHAR(100) nullable | auto-set by reverse geocode |
| role | UserRole | default DONOR |
| fcm_token | VARCHAR(500) nullable | |
| is_blocked | BOOLEAN | default false |
| verif_status | VerifStatus | default UNVERIFIED |
| report_count | INT | default 0 |
| created_at | TIMESTAMPTZ | |
| deleted_at | TIMESTAMPTZ nullable | soft delete |

Indexes: `(blood_group)`, `(verif_status)`, `(phone)`

### Table: donor_profiles
| Column | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID UNIQUE FK | cascade delete |
| is_available | BOOLEAN | default true |
| last_donation_date | DATE nullable | |
| location_lat | FLOAT nullable | Prisma float cols |
| location_lng | FLOAT nullable | |
| location | GEOGRAPHY(POINT,4326) | added via raw migration |
| total_donations | INT | default 0 |
| lives_saved | INT | default 0 |
| response_rate | FLOAT | default 0.0 |

Indexes: `(is_available)`, **GIST `(location)`**, covering `(is_available, last_donation_date) INCLUDE (location, user_id)`

### Table: blood_requests
| Column | Type | Notes |
|---|---|---|
| id | UUID | |
| request_code | VARCHAR(12) UNIQUE | |
| receiver_id | UUID FK | |
| patient_name | VARCHAR(100) | |
| hospital_name | VARCHAR(200) | |
| hospital_lat | FLOAT nullable | |
| hospital_lng | FLOAT nullable | |
| hospital_location | GEOGRAPHY(POINT,4326) | added via raw migration |
| blood_group | BloodGroup | |
| units_needed | INT | |
| units_fulfilled | INT | default 0 |
| urgency | UrgencyLevel | |
| required_by | TIMESTAMPTZ | |
| expires_at | TIMESTAMPTZ | |
| status | RequestStatus | default PENDING |
| created_at | TIMESTAMPTZ | |

Indexes: `(status, urgency)`, `(blood_group, status)`, `(expires_at)`, **GIST `(hospital_location)`**, partial `(expires_at) WHERE status='PENDING'`

### Table: blood_matches
| Column | Type | Notes |
|---|---|---|
| id | UUID | |
| request_id | UUID FK | |
| donor_profile_id | UUID FK | |
| status | MatchStatus | default NOTIFIED |
| distance_km | FLOAT | |
| score | FLOAT | 0-100 composite |
| notified_at | TIMESTAMPTZ | |
| responded_at | TIMESTAMPTZ nullable | |
| donated_at | TIMESTAMPTZ nullable | |
| timeout_at | TIMESTAMPTZ | 2-hour window |
| cancel_reason | TEXT nullable | |

Unique: `(request_id, donor_profile_id)` | Index: `(status, timeout_at)`

### Table: otp_verifs
| Column | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID FK nullable | null for pre-registration |
| phone | VARCHAR(15) | |
| provider | SmsProvider | |
| sent_at | TIMESTAMPTZ | |
| verified_at | TIMESTAMPTZ nullable | |

Index: `(phone, sent_at)`

### Table: refresh_tokens
| Column | Type | Notes |
|---|---|---|
| id | String (CUID) | used as JWT jti |
| user_id | UUID FK | cascade delete |
| token_hash | VARCHAR(128) | SHA256(raw_jwt) |
| expires_at | TIMESTAMPTZ | |
| revoked_at | TIMESTAMPTZ nullable | null = active |
| created_at | TIMESTAMPTZ | |

Indexes: `(user_id)`, `(expires_at)`

### Table: notifications
| Column | Type | Notes |
|---|---|---|
| id | UUID | |
| user_id | UUID FK | cascade delete |
| type | VARCHAR(50) | |
| title | VARCHAR(200) | |
| body | TEXT | |
| is_read | BOOLEAN | default false |
| related_id | UUID nullable | request/match id |
| created_at | TIMESTAMPTZ | |

Indexes: `(user_id, is_read)`, `(created_at)`

### Table: reports
| Column | Type |
|---|---|
| id | UUID |
| reporter_id / reported_id | UUID FK |
| reason | ReportReason |
| details | TEXT nullable |
| resolved_at | TIMESTAMPTZ nullable |
| resolution | TEXT nullable |
| created_at | TIMESTAMPTZ |

Unique: `(reporter_id, reported_id)` | Index: `(reported_id, resolved_at)`

### Table: geocode_cache
| Column | Type | Notes |
|---|---|---|
| id | CUID | |
| query | VARCHAR(500) UNIQUE | normalized address or `rev:lat,lng` |
| lat / lng | FLOAT | |
| display_name | TEXT | |
| cached_at | TIMESTAMPTZ | |

### Table: audit_logs
| Column | Type |
|---|---|
| id | UUID |
| user_id | UUID FK nullable |
| action | VARCHAR(100) |
| entity / entity_id | VARCHAR(50) / UUID nullable |
| meta | JSON nullable |
| ip_address | VARCHAR(45) nullable |
| created_at | TIMESTAMPTZ |

Indexes: `(created_at)`, `(user_id, created_at)`, `date_trunc('month', created_at), user_id`

### PostGIS Raw Migration (must run AFTER prisma migrate deploy)
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
ALTER TABLE donor_profiles ADD COLUMN IF NOT EXISTS location GEOGRAPHY(POINT, 4326);
CREATE INDEX IF NOT EXISTS idx_donor_location ON donor_profiles USING GIST(location);
CREATE INDEX IF NOT EXISTS idx_donor_available_eligible
  ON donor_profiles (is_available, last_donation_date NULLS FIRST)
  INCLUDE (location, user_id);
ALTER TABLE blood_requests ADD COLUMN IF NOT EXISTS hospital_location GEOGRAPHY(POINT, 4326);
CREATE INDEX IF NOT EXISTS idx_request_hospital_location ON blood_requests USING GIST(hospital_location);
CREATE INDEX IF NOT EXISTS idx_request_active_expiry ON blood_requests (expires_at) WHERE status = 'PENDING';
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_month
  ON audit_logs (date_trunc('month', created_at), user_id);
```

---

## 5. Phase 4 — Blood Requests + Matching Engine ✅

**What was built (10 backend files, 2 mobile API files, 6 mobile screens updated):**

#### Backend
- **RequestsModule** (`src/modules/requests/`):
  - `POST /v1/requests` — rate limit 10/hr per user (Redis); geocodes hospital address if no lat/lng; generates `requestCode` (BD+MMDD+6hex); sets PostGIS GEOGRAPHY; enqueues `MATCH_REQUESTS` BullMQ job at radius=10km
  - `GET /v1/requests/nearby` — PostGIS ST_DWithin geo-search for open requests compatible with donor's blood type; 30s Redis cache; requires donor profile with location
  - `GET /v1/requests/mine` — own requests with match counts
  - `GET /v1/requests/:id` — request detail + donor's own match info (`myMatch`) for phone visibility
  - `PATCH /v1/requests/:id/cancel` — validates ownership, cancels NOTIFIED matches
  - `GET /v1/requests/:id/matches` — receiver-only; matches with phone masking (phone revealed only when `status=ACCEPTED`)
- **MatchingModule** (`src/modules/matching/`):
  - `POST /v1/matches/:id/respond` — donor ACCEPT/DECLINE with ownership check; updates `unitsFulfilled`, `responseRate`
  - `MatchingService.runMatching(requestId, radiusKm)` — PostGIS ST_DWithin donor query + ABO/Rh filter + scoring (0-100); upserts BloodMatch records; radius escalation via BullMQ delayed jobs (10→25→50→100→200km)
  - `MatchingProcessor` — BullMQ WorkerHost for `MATCH_REQUESTS` queue
  - `MatchingScheduler` — `@Cron(EVERY_5_MINUTES)`: expire stale requests, timeout matches past 2h window, update responseRate
- **AppModule** — added `BullModule.forRootAsync` (parses REDIS_URL), `ScheduleModule.forRoot()`, `RequestsModule`, `MatchingModule`

#### Mobile
- `src/api/requests.api.ts` — typed wrappers: createRequest, getMyRequests, getNearbyRequests, getRequestById, cancelRequest, getMatchesForRequest
- `src/api/matching.api.ts` — respondToMatch (ACCEPT/DECLINE)
- `App.tsx` — added `QueryClientProvider` with QueryClient (staleTime 30s, retry 1)
- `navigation/types.ts` — `DonorHomeStackParamList.RequestDetails` changed from `{ request: BloodRequest }` to `{ requestId: string }`
- `CreateRequestScreen.tsx` — real API call; hospital name is free-text input; urgency maps to backend enum (CRITICAL/HIGH/MEDIUM/LOW); parses DD/MM/YYYY HH:MM date format
- `NearbyRequestsScreen.tsx` — real API via `useQuery`; pull-to-refresh; empty/error states
- `RequestDetailsScreen.tsx` — fetches by `requestId`; shows `myMatch` status + ACCEPT/DECLINE buttons; phone shown only when match ACCEPTED
- `MatchingDonorsScreen.tsx` — real API via `useQuery`; phone lock icon when not ACCEPTED; polls every 30s
- `RequestStatusScreen.tsx` — real API via `useQuery`; timeline for PENDING→PARTIALLY_FULFILLED→FULFILLED; "View Matching Donors" button
- `DonorDashboardScreen.tsx` — replaced mock with `useQuery` for nearby requests; navigates with `{ requestId }`

**Quality gate checklist:**
- [x] Unit tests: ABO/Rh compatibility matrix (all 8 groups × compatibility lists) — 64 combinations via `it.each`
- [x] Unit tests: match scoring formula edge cases — perfect=100, clamping, verif tiers, exp tiers, rate %
- [x] Unit tests: radius escalation (BullMQ delayed job scheduling) — STANDARD + CRITICAL tested
- [x] Phone masking: raw phone never in response for `status=NOTIFIED`
- [x] Phone revealed: confirmed when `status=ACCEPTED`
- [x] PostGIS geo-search with ST_DWithin (no haversine regression)

---

## 5b. Phase 4 — Blood Requests + Matching Engine (SPEC, now DONE)

### Files to Create

#### Backend
```
src/modules/requests/
  requests.module.ts
  requests.controller.ts       POST /v1/requests, GET /v1/requests/mine,
                               GET /v1/requests/:id, PATCH /v1/requests/:id/cancel
  requests.service.ts
  dto/create-request.dto.ts    bloodGroup, hospitalName, hospitalAddress OR lat/lng,
                               unitsNeeded, urgency, requiredBy, patientName
  dto/update-request.dto.ts

src/modules/matching/
  matching.module.ts
  matching.service.ts          ABO/Rh compatibility filter, PostGIS ST_DWithin query,
                               score calculation, radius escalation via BullMQ delayed jobs
  matching.processor.ts        BullMQ processor for MATCH_REQUEST queue
  matching.scheduler.ts        cron: expire stale requests, timeout matches
  dto/respond-to-match.dto.ts
```

#### Mobile
```
src/api/requests.api.ts
src/api/matching.api.ts
```

#### Screens to wire (real API replacing mock data)
```
CreateRequestScreen.tsx           POST /v1/requests + Nominatim geocode hospital address
MatchingDonorsScreen.tsx          GET /v1/requests/:id/matches (with phone masking)
RequestStatusScreen.tsx           GET /v1/requests/:id
NearbyRequestsScreen.tsx          GET /v1/donors/nearby-requests (PostGIS)
RequestDetailsScreen.tsx          POST /v1/matches/:id/respond
```

### ABO/Rh Compatibility Matrix (source of truth in packages/types)
```typescript
const BLOOD_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  'A+':  ['A+', 'A-', 'O+', 'O-'],
  'A-':  ['A-', 'O-'],
  'B+':  ['B+', 'B-', 'O+', 'O-'],
  'B-':  ['B-', 'O-'],
  'AB+': ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'],
  'AB-': ['A-', 'B-', 'AB-', 'O-'],
  'O+':  ['O+', 'O-'],
  'O-':  ['O-'],
};
```

### Core PostGIS Geo-Search Query (must use ST_DWithin — NO haversine regression)
```sql
SELECT
  dp.id AS donor_profile_id,
  u.id AS user_id,
  u.name,
  u.blood_group,
  ST_Distance(dp.location, ST_GeogFromText('SRID=4326;POINT(:lng :lat)')) / 1000 AS distance_km,
  dp.total_donations,
  dp.response_rate,
  u.verif_status
FROM donor_profiles dp
INNER JOIN users u ON u.id = dp.user_id
WHERE
  dp.location IS NOT NULL
  AND dp.is_available = true
  AND u.is_blocked = false
  AND u.deleted_at IS NULL
  AND u.blood_group = ANY(:compatibleGroups)
  AND (dp.last_donation_date IS NULL
       OR dp.last_donation_date <= NOW() - INTERVAL '56 days')
  AND ST_DWithin(dp.location, ST_GeogFromText('SRID=4326;POINT(:lng :lat)'), :radiusMeters)
ORDER BY distance_km ASC
LIMIT 50
```

### Match Scoring Formula (0-100 total)
```
distance score  = max(0, 40 - floor(distance_km / radius_km * 40))    [0-40 pts]
availability    = donor.isAvailable ? 20 : 0                           [0-20 pts]
verification    = VERIFIED=20, PENDING=10, else 0                      [0-20 pts]
experience      = totalDonations >= 6 ? 10 : >= 3 ? 7 : >= 1 ? 4 : 0 [0-10 pts]
responseRate    = round(responseRate * 10)                             [0-10 pts]
```

### Radius Escalation (BullMQ delayed jobs)
```
t=0:    search 10 km   -> if >= 3 donors found, notify and stop
t+2hr:  search 25 km   -> if >= 2 donors found
t+4hr:  search 50 km
t+8hr:  search 100 km
t+24hr: search 200 km  -> notify all found
```

### Phone Masking (M-03 — MUST NOT break)
```typescript
// In MatchingDonorsScreen response — backend enforces this:
phone: match.status === 'ACCEPTED' ? user.phone : user.phone.replace(/\d{6}$/, 'XXXXXX')
// Raw phone NEVER returned when status is NOTIFIED, CANCELLED, or TIMED_OUT
```

### Redis Caching
```
Key: nearby-requests:{lat4dp}:{lng4dp}:{bloodGroup}
TTL: 30 seconds
Invalidated on: new request created in same area
```

### Phase 4 Quality Gate
- [x] Unit tests: ABO/Rh compatibility matrix (all 8 groups x compatibility lists)
- [x] Unit tests: match scoring formula, edge cases (max/min distance, unverified donor)
- [x] Unit tests: radius escalation logic (BullMQ job scheduling)
- [x] e2e test: full create-request -> match -> respond flow (donor-journey.e2e-spec.ts)
- [ ] k6 load test: geo-search p95 < 500 ms at 50 km, 100 concurrent users (script written; baseline not yet captured)
- [x] Phone masking: confirmed in API response for status=NOTIFIED
- [x] Phone unmasked: confirmed when status=ACCEPTED

---

## 6. Remaining Phases (Summary)

| Phase | Module | Status |
|---|---|---|
| 0 | Monorepo scaffold, infra, CI/CD | DONE |
| 1 | Prisma schema + PostGIS migration | DONE (as part of Phase 0) |
| 2 | Auth (OTP, JWT RS256, SMS chain) | DONE |
| 3 | Users, Donors, Geolocation (56-day, Nominatim) | DONE |
| 4 | Blood Requests + Matching Engine | DONE |
| 5 | Notifications + WebSocket (FCM, Socket.io + Redis adapter) | DONE |
| 6 | Trust & Safety (donation confirm, reports, auto-suspend) | DONE |
| 7 | Admin Portal (Vite + Ant Design dashboard) | DONE |
| **8** | **Production Hardening (mock removal, Sentry, runbooks)** | **DONE** |

---

## 7. Critical Invariants (Never Break)

1. **GIST index on `donor_profiles.location`** — must exist before any geo-query; added in `0001_postgis_setup.sql`
2. **56-day rule** — `last_donation_date <= NOW() - INTERVAL '56 days'` in every donor query
3. **Phone masking** — raw phone never returned when `match.status IN ('NOTIFIED', 'CANCELLED', 'TIMED_OUT')`
4. **OTP** — bcrypt cost 10, 300 s TTL, 3 attempts max, 1800 s lockout; ConsoleSms in dev
5. **Soft delete** — `prisma.service.ts` middleware excludes `deletedAt IS NOT NULL` from findMany/findFirst/findUnique on User
6. **JWT RS256** — private key decoded from `JWT_PRIVATE_KEY` (base64 env var); never committed
7. **Single-region trade-off** — PostgreSQL on Neon/Supabase (not Multi-AZ); mitigated by PITR + restore runbook at `/docs/runbooks/` (to be created Phase 8)
8. **SMS provider order** — MSG91 primary -> Twilio fallback -> Console dev (never reversed)
9. **WebSocket** — must use Redis adapter (`@socket.io/redis-adapter`) for multi-instance Railway/Render deploys (Phase 5)
10. **Refresh token reuse detection** — on hash mismatch, ALL tokens for that user are revoked immediately

---

## 8. Environment Variables (Required to Start)

```bash
# Core
NODE_ENV=development
PORT=3000
CORS_ORIGIN=http://localhost:8081

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/blooddonation

# Redis
REDIS_URL=redis://localhost:6379

# JWT (RS256 — base64-encoded PEM)
# Generate:
#   openssl genrsa 2048 | base64 -w0  -> JWT_PRIVATE_KEY
#   openssl rsa -pubout | base64 -w0  -> JWT_PUBLIC_KEY
JWT_PRIVATE_KEY=<base64-encoded-RSA-private-key>
JWT_PUBLIC_KEY=<base64-encoded-RSA-public-key>
JWT_ACCESS_TTL=900
JWT_REFRESH_TTL=604800

# SMS (console = no real SMS in dev)
SMS_PROVIDER=console
# MSG91_AUTH_KEY, MSG91_SENDER_ID, MSG91_TEMPLATE_ID   <- required if SMS_PROVIDER=msg91
# TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER <- required if SMS_PROVIDER=twilio

# Geocoding
NOMINATIM_BASE_URL=https://nominatim.openstreetmap.org

# Rate limits
RATE_LIMIT_SEND_OTP_PER_HOUR=5
RATE_LIMIT_VERIFY_OTP_PER_5MIN=3
RATE_LIMIT_CREATE_REQUEST_PER_HOUR=10
RATE_LIMIT_REPORT_PER_DAY=5
RATE_LIMIT_DEFAULT_PER_MIN=100

# Admin
ADMIN_ALLOWED_IPS=127.0.0.1

# Phase 5+
FCM_PROJECT_ID=
FCM_PRIVATE_KEY=
FCM_CLIENT_EMAIL=

# Phase 8
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
SENDGRID_API_KEY=
SENTRY_DSN=
GRAFANA_PUSH_URL=
```

### Mobile (.env.local in apps/mobile/)
```bash
EXPO_PUBLIC_API_URL=http://localhost:3000
# Android emulator: http://10.0.2.2:3000
# iOS simulator: http://localhost:3000
# Physical device: http://<your-machine-ip>:3000
```

---

## 9. API Endpoints Reference (Phases 0-3)

### Auth (all @Public)
| Method | Path | Auth | Description |
|---|---|---|---|
| POST | /v1/auth/send-otp | None | Send OTP to phone |
| POST | /v1/auth/verify-otp | None | Verify OTP, get tokens or otpSession |
| POST | /v1/auth/register | None | Complete registration with otpSession |
| POST | /v1/auth/refresh | None + refresh token in body | Rotate token pair |
| POST | /v1/auth/logout | Bearer | Revoke all refresh tokens |

### Users (Bearer required)
| Method | Path | Description |
|---|---|---|
| GET | /v1/users/me | Get authenticated user + donorProfile |
| PATCH | /v1/users/me | Update name, city, area, fcmToken, gender, dob |

### Donors (Bearer required)
| Method | Path | Description |
|---|---|---|
| POST | /v1/donors/profile | Create donor profile (one-time) |
| GET | /v1/donors/profile | Get profile with eligibility info |
| PATCH | /v1/donors/profile | Update availability / location |

### Health (no auth)
| Method | Path | Description |
|---|---|---|
| GET | /health | Returns db, redis, uptime status |

---

## 10. Test Pass & Bug Fixes Log (2026-06-17)

### Bug Fixes

#### Bug #1 — BLOCKER (BR-03): Unverified donors in match results — FIXED ✅
- **File:** `apps/backend/src/modules/matching/matching.service.ts`
- **Root cause:** PostGIS donor query was missing a `verif_status` filter. Unverified and suspended donors could appear in match results and receive patient contact details.
- **Fix:** Added `AND u.verif_status = 'VERIFIED'` to the WHERE clause of the `$queryRaw` donor search.

#### Bug #2 — MAJOR (BR-05): CRITICAL requests starting at wrong radius — FIXED ✅
- **Files:**
  - `apps/backend/src/modules/requests/requests.service.ts` (~line 105)
  - `apps/backend/src/modules/matching/matching.service.ts`
  - `apps/backend/src/modules/matching/matching.utils.ts` (new)
- **Root cause:** All requests (including CRITICAL) enqueued the initial BullMQ job with `radiusKm: 10`. Blueprint §4.2 requires CRITICAL to start at 50 km and escalate to 200 km at T+30min, not follow the STANDARD ladder.
- **Fix part 1 (requests.service.ts):** `const startRadius = dto.urgency === UrgencyLevel.CRITICAL ? 50 : 10;`
- **Fix part 2 (matching.service.ts):** Selects `CRITICAL_ESCALATION` or `STANDARD_ESCALATION` based on `request.urgency`:
  ```typescript
  const escalationTable = request.urgency === UrgencyLevel.CRITICAL
    ? CRITICAL_ESCALATION
    : STANDARD_ESCALATION;
  ```
- **CRITICAL_ESCALATION table:** `50km → 200km at T+30min` (no intermediate stops)
- **STANDARD_ESCALATION table:** `10→25→50→100→200km` with 2h/2h/4h/16h delays

#### Bug #5 — MINOR: Tautological auth tests — FIXED ✅
- **File:** `apps/backend/src/modules/auth/auth.service.spec.ts`
- **Root cause:** 3 tests asserted trivial constants (`expect(300).toBe(5 * 60)` etc.) with no behavioral coverage.
- **Fix:** Removed the 3 tautological tests; added 4 `register()` behavioral tests (invalid otpSession JWT → 401, no pending session → 401, phone conflict → 409, valid flow → tokens).

---

### New Utility File

**`apps/backend/src/modules/matching/matching.utils.ts`**

Extracted from `matching.service.ts` to make these testable as pure functions:
- `BLOOD_COMPATIBILITY: Record<string, string[]>` — ABO/Rh recipient→compatible-donor matrix
- `STANDARD_ESCALATION: EscalationStage[]` — 10→25→50→100→200km ladder
- `CRITICAL_ESCALATION: EscalationStage[]` — 50→200km at T+30min (Blueprint §4.2)
- `EscalationStage` interface — `{ radius, threshold, nextRadius, nextDelayMs }`
- `scoreMatch(distanceKm, radiusKm, donor)` — returns 0-100 composite score

---

### Test Suite State (all green)

| Spec File | Tests | Coverage |
|---|---|---|
| `auth.service.spec.ts` | 9 | FR-01/02, OTP policy |
| `donors.service.spec.ts` | 10 | FR-07/08, 56-day rule |
| `matching.service.spec.ts` | 67 | FR-10/11/12, BR-01/02/03/05, scoreMatch, escalation |
| `matching.scheduler.spec.ts` | 9 | BR-08, BR-09, expiry/timeout cron |
| `requests.service.spec.ts` | 33 | FR-09, BR-04/05, M-03 phone masking |
| `reports.service.spec.ts` | 24 | FR-14, BR-07, EC-08 auto-suspend |
| **Total** | **152 unit** | **+ 3 E2E spec files + 1 k6 script** |

Run: `npx jest --no-coverage` from `apps/backend/`

---

### Test Infrastructure Notes

- **Prisma custom output path:** Schema declares `output = "../apps/backend/node_modules/.prisma/client"`. The standard `@prisma/client` in root `node_modules` is a stub; tests must resolve to the custom path.
- **tsconfig.json** (`apps/backend/tsconfig.json`): Added path mapping `"@prisma/client": ["node_modules/.prisma/client"]`
- **jest moduleNameMapper** (`apps/backend/package.json`):
  ```json
  "^@prisma/client$": "<rootDir>/../node_modules/.prisma/client",
  "^@prisma/client/runtime/library$": "<rootDir>/../node_modules/.prisma/client/runtime/library.js"
  ```
- **`PrismaClientKnownRequestError`** must be imported from `@prisma/client/runtime/library`, not `Prisma.PrismaClientKnownRequestError` (not on the namespace in v5).
- **Regenerate client** if stale: `npx prisma generate --schema=prisma/schema.prisma` from monorepo root.
- **CI:** `.github/workflows/ci.yml` runs `test:integration` (picks up both `.spec.ts` unit tests and `.e2e-spec.ts` files) with PostGIS + Redis service containers.

---

### Open Bugs (not yet fixed)

| ID | Severity | Description | Fix Location |
|---|---|---|---|
| Bug #3 (BR-10) | MAJOR | No `POST /requests/:id/reactivate` endpoint — cancelled requests cannot be re-opened within 6h | `requests.controller.ts` + `requests.service.ts` |
| Bug #4 (EC-06) | MEDIUM | No duplicate open-request check in `createRequest()` — a user can open multiple simultaneous requests | `requests.service.ts` before `prisma.bloodRequest.create` |

---

### Deliverables Added
- `docs/test-report.md` — before/after metrics (18→166 tests), FR/BR/EC coverage per layer, coverage gaps table
- `docs/pre-launch-signoff.md` — 49-item sign-off checklist, 8-week action plan, DLT registration critical path

---

_End of project state document_
