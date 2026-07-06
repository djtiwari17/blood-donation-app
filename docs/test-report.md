# Blood Donation App — Test Report
**Generated:** 2026-06-16  
**Phase:** STEP 2 — Test Pass Complete  
**Auditor:** Claude Sonnet 4.6

---

## Executive Summary

| Metric | Before | After |
|--------|--------|-------|
| Spec files | 2 | 7 |
| Unit tests | 18 (15 real, 3 tautological) | ~120 real tests |
| FR coverage | 5/34 (15%) | ~22/34 (65%) |
| BR coverage | 2/11 (18%) | 8/11 (73%) |
| Edge case coverage | 1/11 (9%) | 7/11 (64%) |
| Real bugs found | 0 previously reported | 5 total (2 fixed in this pass) |

---

## Layer 1 — Unit Tests

### `matching.service.spec.ts` *(new)*
**Tests: ~45**

| Test Group | What it verifies | Maps to |
|---|---|---|
| BLOOD_COMPATIBILITY 8×8 matrix | All 64 recipient→donor combinations | FR-10, BR-03, life-safety |
| `scoreMatch` formula | Distance(0-40), availability(20), verif(20), exp(10), rate(10) | FR-10 |
| STANDARD_ESCALATION | 10→25→50→100→200km, thresholds, delays | BR-05 |
| CRITICAL_ESCALATION | Starts at 50km, jumps to 200km at T+30min | BR-05 |
| `runMatching` early returns | Missing request / wrong status / no location | FR-10 |
| `runMatching` escalation logic | Enqueues next radius job with correct delay | BR-05 |
| `runMatching` CRITICAL at 10km | Logs warn, does NOT enqueue (unknown stage) | BR-05 |
| `runMatching` match creation | Creates BloodMatch and notifies donor | FR-11 |
| `runMatching` deduplication | Skips if match already exists | EC-05 |
| `respondToMatch` guards | 404 if no profile/match; 400 if already responded | FR-12 |
| `respondToMatch` ACCEPT | Updates to ACCEPTED, sets PARTIALLY_FULFILLED/FULFILLED | FR-12 |
| `respondToMatch` DECLINE | Updates to CANCELLED | FR-12 |
| `confirmDonation` guards | 404 no profile/match; 400 if not ACCEPTED | FR-13 |
| `confirmDonation` transaction | Updates match/profile/request atomically | FR-13 |
| `confirmDonation` fulfillment | Marks request FULFILLED when last unit confirmed | FR-13 |

### `requests.service.spec.ts` *(new)*
**Tests: ~20**

| Test Group | What it verifies | Maps to |
|---|---|---|
| `generateCode` format | `BD{MMDD}{6HEX}` pattern, uniqueness | FR-09 |
| `createRequest` rate limit | 429 after 10/hour | BR-09, §9.3 |
| `createRequest` CRITICAL radius | Enqueues at 50km not 10km | BR-05 (Bug #2 FIX) |
| `createRequest` non-CRITICAL radius | Enqueues at 10km | BR-05 |
| `createRequest` no location | Does not enqueue when lat/lng unavailable | FR-09 |
| Phone masking NOTIFIED | Last 6 digits replaced with XXXXXX | M-03 |
| Phone masking ACCEPTED | Full phone revealed | M-03 |
| Phone masking DONATED | Still masked (only ACCEPTED reveals) | M-03 |
| `getMatchesForRequest` auth | 403 if not request owner | FR-15 |
| `cancelRequest` not found | 404 | FR-16 |
| `cancelRequest` wrong owner | 403 | FR-16 |
| `cancelRequest` wrong status | 400 for FULFILLED/EXPIRED | FR-16 |
| `cancelRequest` happy path | Cancels request + NOTIFIED matches | FR-16 |
| `getNearbyRequests` no profile | 404 | FR-08 |
| `getNearbyRequests` no location | 400 | FR-08 |

### `reports.service.spec.ts` *(new)*
**Tests: ~12**

| Test Group | What it verifies | Maps to |
|---|---|---|
| Self-report | 400 before any Redis/DB call | EC-08 |
| Rate limit: 5 allowed | Returns success at count=5 | §9.3 |
| Rate limit: 429 at 6th | Throws before DB write | §9.3 |
| Rate limit TTL | `expire(key, 86400)` called on first report | §9.3 |
| Reported user not found | 404 | FR-20 |
| Duplicate report | 409 on P2002 | EC-09 |
| No suspend at 1 report | `user.update(SUSPENDED)` not called | BR-07 |
| No suspend at 2 reports | `user.update(SUSPENDED)` not called | BR-07 |
| Auto-suspend at 3 | Sets SUSPENDED + isBlocked=true | BR-07 |
| Match cancellation | Cancels NOTIFIED matches on suspend | BR-07 |
| No match cancel if no profile | Skips when user has no donor profile | BR-07 |
| No re-suspend | Already-SUSPENDED user not updated again | BR-07 |

### `matching.scheduler.spec.ts` *(new)*
**Tests: ~10**

| Test Group | What it verifies | Maps to |
|---|---|---|
| `expireStaleRequests` no-op | Returns early when nothing stale | FR-17 |
| `expireStaleRequests` batch | Marks EXPIRED, cancels NOTIFIED matches | FR-17 |
| `expireStaleRequests` notify | Calls `notifyRequestExpired` per receiver | FR-17 |
| `expireStaleRequests` query | Filters PENDING/PARTIALLY_FULFILLED + expiresAt | FR-17 |
| `timeoutStaleMatches` no-op | Returns early when nothing timed out | FR-18 |
| `timeoutStaleMatches` batch | Marks TIMED_OUT | FR-18 |
| `timeoutStaleMatches` rate | Recalculates responseRate per donor | FR-18 |
| `timeoutStaleMatches` dedup | Deduplicates donor IDs (3 matches → 1 update) | FR-18 |
| `timeoutStaleMatches` zero total | Sets responseRate=0 when no matches | FR-18 |

### `auth.service.spec.ts` *(updated)*
**Tests: 13 (9 existing kept, 3 tautological removed, 4 `register` tests added)**

| Change | Detail |
|---|---|
| Removed | 3 tautological constants: `expect(300).toBe(5 * 60)` etc. |
| Added | `register` throws 401 for invalid JWT |
| Added | `register` throws 401 for expired pending session |
| Added | `register` throws 409 for existing phone |
| Added | `register` creates user and returns tokens |

### `donors.service.spec.ts` *(existing — already good)*
- 10 tests covering 56-day eligibility boundary — no changes needed

---

## Layer 2 — Integration Tests
**Status: Written, require `DATABASE_URL` + `REDIS_URL` to run (CI has them)**

Tests skip automatically when env vars absent (`describe.skip` conditional).

| Test File | What it verifies |
|---|---|
| `donor-journey.e2e-spec.ts` | OTP→register→profile→toggle→56-day boundary, US-07 timing |
| `security.e2e-spec.ts` | JWT tamper, role gating, phone masking, input validation |
| `trust-safety.e2e-spec.ts` | 3-report auto-suspend, match cancellation, EC-08, duplicate report |

---

## Layer 6 — Performance
**Status: k6 script written, run manually against seeded DB**

```
k6 run --env BASE_URL=http://localhost:3000 --env TOKEN=<jwt> \
       apps/backend/test/k6/geo-search.k6.js
```

Thresholds:
- `geo_search_duration p(95) < 500ms` — US-07
- `profile_get_duration p(95) < 300ms` — US-07
- `error_rate < 1%`

---

## Real Bugs Found and Fixed

### Bug #1 — BLOCKER — Fixed ✅
**File:** `apps/backend/src/modules/matching/matching.service.ts`  
**Line:** PostGIS query WHERE clause  
**Description:** Query did NOT filter `u.verif_status = 'VERIFIED'`. Unverified (UNVERIFIED, PENDING, REJECTED, SUSPENDED) donors appeared in match results. The score formula gave them 0–10 verif points but DID NOT exclude them.  
**Fix:** Added `AND u.verif_status = 'VERIFIED'` to the WHERE clause.  
**Maps to:** BR-03 ("only verified donors appear in match results")

### Bug #2 — MAJOR — Fixed ✅
**File 1:** `apps/backend/src/modules/requests/requests.service.ts` line 104  
**File 2:** `apps/backend/src/modules/matching/matching.service.ts` escalation logic  
**Description:** CRITICAL requests always started at `radiusKm: 10`. Blueprint §4.2 requires starting at 50km, then jumping to 200km at T+30min. The ESCALATION table also had no CRITICAL-specific entries.  
**Fix:**
1. `requests.service.ts`: `const startRadius = dto.urgency === UrgencyLevel.CRITICAL ? 50 : 10`
2. `matching.service.ts`: Added `CRITICAL_ESCALATION` table; `runMatching()` now selects table based on `request.urgency`  
**Maps to:** BR-05

### Bug #3 — MAJOR — Not yet implemented ⚠️
**File:** Feature entirely absent  
**Description:** BR-10 requires that a cancelled request can be reactivated within 6 hours. No such endpoint exists (`/requests/:id/reactivate`). A `CANCELLED` request cannot be un-cancelled anywhere in the codebase.  
**Recommended fix:** Add `POST /requests/:id/reactivate` that checks `cancelledAt + 6h > now()` and resets status to PENDING, then re-enqueues the match job.  
**Severity:** MAJOR — documented in pre-launch signoff as known gap

### Bug #4 — MEDIUM — Not yet implemented ⚠️
**File:** `apps/backend/src/modules/requests/requests.service.ts`  
**Description:** EC-06 — "duplicate open request for same blood group and hospital" should warn the user. No check exists before creating a new request. A user can create unlimited duplicate pending requests.  
**Recommended fix:** Before `prisma.bloodRequest.create`, check for existing PENDING/PARTIALLY_FULFILLED requests with same `receiverId + bloodGroup + hospitalName`; return 409 or a warning.  
**Severity:** MEDIUM — users waste donor bandwidth; included in known-issue list

### Bug #5 — MINOR — Fixed ✅ (in auth spec update)
**File:** `apps/backend/src/modules/auth/auth.service.spec.ts`  
**Description:** 3 tests in "OTP policy constants" tested literal constants (`expect(300).toBe(5 * 60)`) with no relation to the service implementation. They pass regardless of any code change.  
**Fix:** Replaced with 4 meaningful `register()` method tests that cover previously-untested behavior.

---

## Coverage Gaps Remaining

| Area | Gap | Recommendation |
|---|---|---|
| FR-03 (refresh token) | Not tested | Add to auth spec Layer 1 |
| FR-04 (logout) | Not tested | Add to auth spec Layer 1 |
| FR-19 (admin verification) | Not tested | Add admin.service.spec.ts |
| BR-06 (Partially Fulfilled → still accepts donors) | No test | Add to matching Layer 3 |
| BR-10 (reactivate cancelled request) | Feature missing | Implement + test |
| EC-06 (duplicate request warning) | Feature missing | Implement + test |
| EC-03 (donor marks unavailable when matched) | No test | Add to matching Layer 3 |
| WebSocket push events | Not tested at unit level | Integration test with WS client |
| BullMQ queue behavior | Not tested | Integration test with real Redis |
| PostGIS index usage | Not tested | EXPLAIN ANALYZE in integration test |

---

## Known Limitations

1. **E2E tests need running infra**: The 3 E2E test files skip automatically when `DATABASE_URL`/`REDIS_URL` are absent. They run in CI (which has the service containers) but not locally without Docker.

2. **OTP in E2E tests**: Tests pre-seed the OTP hash directly into Redis to avoid needing an SMS provider. This is the standard pattern for console-provider E2E.

3. **k6 baseline not yet captured**: The performance thresholds (p95 < 500ms) are based on Blueprint acceptance criteria. A baseline run with 10,000 seeded donors is needed before reporting pass/fail.

4. **Mobile tests**: No Jest component tests for the 19 React Native screens. All screens now use real API (Phase 8 complete). Mobile testing requires either Expo's test runner or React Native Testing Library setup, which is not yet configured.
