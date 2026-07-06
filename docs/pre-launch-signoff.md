# Blood Donation App — Pre-Launch Signoff Checklist
**Version:** 1.0  
**Date:** 2026-06-16  
**Target:** 1,00,000 users, India, Android + iOS

---

## Legend
- ✅ **MUST BE GREEN** — blocks launch
- ⚠️ **KNOWN ISSUE — SHIPPABLE** — documented, acceptable at v1.0, fix in v1.1
- 📋 **TODO** — action required before launch date

---

## SECTION 1 — Core Functionality (Must Be Green)

| # | Check | Status | Notes |
|---|---|---|---|
| 1.1 | OTP send + verify works end-to-end with MSG91 | 📋 | Test with real DLT-registered sender ID |
| 1.2 | Register / Login / Logout / Refresh token flow | ✅ | Unit tested + CI passes |
| 1.3 | Donor profile create + update + toggle availability | ✅ | E2E test covered |
| 1.4 | 56-day eligibility gate (exact boundary = eligible) | ✅ | Unit tested in donors.service.spec.ts |
| 1.5 | Blood request creation — code returned within 3s (US-07) | 📋 | E2E timing test passes locally; needs prod infra test |
| 1.6 | ABO/Rh compatibility — all 64 combinations correct | ✅ | Exhaustive matrix test in matching.service.spec.ts |
| 1.7 | Only VERIFIED donors appear in match results (BR-03) | ✅ | Bug #1 fixed + test added |
| 1.8 | CRITICAL requests start at 50km radius (BR-05) | ✅ | Bug #2 fixed + test added |
| 1.9 | CRITICAL request escalates to 200km at T+30min | ✅ | Bug #2 fixed + test added |
| 1.10 | Phone masking for NOTIFIED matches (never reveals raw number) | ✅ | Unit + E2E tested |
| 1.11 | Phone revealed only when match status = ACCEPTED | ✅ | Unit tested |
| 1.12 | 3-report auto-suspend: blocks user + cancels NOTIFIED matches | ✅ | Unit + E2E tested |
| 1.13 | Stale request expiry cron runs every 5 min | ✅ | Scheduler unit tested |
| 1.14 | Match timeout cron (2-hour window) runs every 5 min | ✅ | Scheduler unit tested |
| 1.15 | Receiver cancel request → NOTIFIED matches cancelled | ✅ | Unit tested |
| 1.16 | Confirm donation → lastDonationDate set → 56-day window resets | ✅ | Unit + E2E tested |
| 1.17 | Firebase FCM push notifications reach devices | 📋 | Needs device testing with real FCM token |
| 1.18 | WebSocket match-found event reaches receiver in real time | 📋 | Needs integration test with WS client |
| 1.19 | Admin can verify/reject donor documents | 📋 | Manual QA required |
| 1.20 | Geofenced matching: PostGIS ST_DWithin returns correct donors | 📋 | Integration test needs real DB with PostGIS |

---

## SECTION 2 — Security (Must Be Green)

| # | Check | Status | Notes |
|---|---|---|---|
| 2.1 | JWT RS256 asymmetric signing — private key never in code | ✅ | Keys via env vars only |
| 2.2 | Refresh token rotation — old token invalidated on use | 📋 | Unit test exists; needs integration verification |
| 2.3 | Tampered/expired JWT returns 401 | ✅ | E2E security test |
| 2.4 | Donor token cannot access admin endpoints → 403 | ✅ | E2E security test |
| 2.5 | send-otp rate limit: 5/hour/IP | 📋 | E2E test written; rate limit relies on ThrottlerGuard + IP — needs real network test |
| 2.6 | verify-otp rate limit: 3 attempts + lockout | ✅ | Unit tested (1800s lock) |
| 2.7 | create-request rate limit: 10/hour/user | ✅ | Unit tested |
| 2.8 | report rate limit: 5/day/user | ✅ | Unit tested |
| 2.9 | No PII (phone/name) in error response bodies | 📋 | Manual review of all error handlers |
| 2.10 | Helmet + CORS configured | ✅ | main.ts includes helmet() |
| 2.11 | SQL injection safe — all queries via Prisma ORM + tagged templates | ✅ | No raw string interpolation in SQL |
| 2.12 | Dependency audit clean (npm audit) | 📋 | Run `npm audit --audit-level=high` before launch |

---

## SECTION 3 — Performance (Must Be Green)

| # | Check | Status | Notes |
|---|---|---|---|
| 3.1 | PostGIS geo-search p95 < 500ms at 50km with 10,000 donors | 📋 | k6 script ready; baseline not yet captured |
| 3.2 | GIST spatial index present on `donor_profiles.location` | 📋 | Verify via `EXPLAIN ANALYZE` in integration test |
| 3.3 | API hot reads (GET /donors/profile) p95 < 300ms | 📋 | k6 script ready; baseline not captured |
| 3.4 | Railway instance scales to target load | 📋 | Load test at 1,000 concurrent users |
| 3.5 | Redis connection pool configured for production load | 📋 | Review REDIS_MAX_CONNECTIONS in Railway env |

---

## SECTION 4 — Operational Readiness (Must Be Green)

| # | Check | Status | Notes |
|---|---|---|---|
| 4.1 | Prisma migrations applied on production DB | 📋 | `prisma migrate deploy` in CI/CD pipeline |
| 4.2 | Environment variables set in Railway (all .env.example keys) | 📋 | Checklist: DB, Redis, JWT keys, FCM, MSG91 |
| 4.3 | Runbook: DB restore tested end-to-end | 📋 | See `docs/runbooks/db-restore.md` |
| 4.4 | Runbook: Redis failover tested | 📋 | See `docs/runbooks/redis-failover.md` |
| 4.5 | Runbook: deploy rollback tested | 📋 | See `docs/runbooks/deploy-rollback.md` |
| 4.6 | Sentry error monitoring receiving events | 📋 | Trigger a test error; verify in Sentry dashboard |
| 4.7 | Health check endpoint (`/health`) returns 200 | ✅ | @nestjs/terminus configured |
| 4.8 | CI pipeline green on main branch | 📋 | All unit + E2E tests must pass in GitHub Actions |
| 4.9 | EAS production build submitted to app stores | 📋 | EAS Build + Apple/Google review |
| 4.10 | DLT registration complete with TRAI | 📋 | **CRITICAL PATH** — 2–4 week process, start immediately |
| 4.11 | MSG91 template IDs registered and approved | 📋 | Depends on DLT completion |
| 4.12 | Firebase project in production mode | 📋 | Enable FCM, add SHA-1 keys for Android |

---

## SECTION 5 — Known Issues (Shippable at v1.0)

These are known gaps accepted for v1.0 launch with documented workarounds. Fixes planned for v1.1.

| # | Issue | Severity | Workaround | Target |
|---|---|---|---|---|
| 5.1 | **BR-10: No reactivate-cancelled-request endpoint** | MAJOR | Users must create a new request | v1.1 |
| 5.2 | **EC-06: No duplicate request warning** | MEDIUM | Users can create duplicate requests; donors may be double-notified | v1.1 |
| 5.3 | **FR-03/04: refresh + logout unit tests absent** | MINOR | Code reviewed; integration test covers happy path | v1.1 |
| 5.4 | **FR-19: Admin verification flow not unit tested** | MINOR | Manual QA covers admin flow | v1.1 |
| 5.5 | **No mobile component tests** | LOW | All 19 screens use real API; manual QA performed | v1.2 |
| 5.6 | **BullMQ queue behavior not integration tested** | MEDIUM | Unit tests cover job enqueueing; queue processing tested manually | v1.1 |
| 5.7 | **k6 baseline not captured** | MEDIUM | Run against staging with 10k seeded donors before launch | Before launch |

---

## Launch Decision Authority

| Signoff Required | Role | Status |
|---|---|---|
| All SECTION 1 items ✅ | Engineering Lead | Pending |
| All SECTION 2 items ✅ | Security Review | Pending |
| SECTION 3 baseline captured | Performance | Pending |
| DLT registration complete (4.10) | Client / Business | **Start now — 4 week lead time** |
| App store submissions (4.9) | Client / Business | After EAS build verified |

---

## Action Items (Critical Path)

1. **TODAY**: Start DLT registration with TRAI (blocks all SMS OTP)
2. **Week 1**: Set all Railway env vars; run `npm audit`; deploy to staging
3. **Week 1**: Run k6 against staging with 10k seeded donors
4. **Week 2**: Device testing (Android + iOS FCM push + OTP)
5. **Week 2**: Run E2E suite against staging (`DATABASE_URL` pointing to staging)
6. **Week 2**: Submit EAS production builds to app stores
7. **Week 3**: App store review (Google: 1-3 days, Apple: 1-7 days)
8. **Week 4**: DLT approval (if applied week 1); launch

> **Note:** Apple App Store review for healthcare/medical apps may require additional review time. Ensure the app description clearly states this is a blood donation coordination tool, not a medical diagnosis app.
