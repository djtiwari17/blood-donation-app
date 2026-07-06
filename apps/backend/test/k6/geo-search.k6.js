/**
 * Layer 6 — Performance: PostGIS geo-search benchmark
 *
 * Acceptance criteria (US-07):
 *   - p95 response time < 500ms at 50km radius with 10,000 seeded donors
 *   - p95 API hot reads < 300ms
 *
 * Prerequisites:
 *   - k6 installed: https://k6.io/docs/get-started/installation/
 *   - 10,000 donor records seeded (see test/fixtures/seed-donors.ts)
 *   - App running at BASE_URL
 *
 * Run:
 *   k6 run --env BASE_URL=http://localhost:3000 --env TOKEN=<donor_jwt> \
 *          apps/backend/test/k6/geo-search.k6.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const geoSearchDuration = new Trend('geo_search_duration', true);
const profileDuration   = new Trend('profile_get_duration', true);
const errorRate         = new Rate('error_rate');

export const options = {
  scenarios: {
    geo_search: {
      executor: 'constant-vus',
      vus: 50,
      duration: '60s',
    },
  },
  thresholds: {
    // US-07: geo-search p95 < 500ms
    geo_search_duration: ['p(95)<500'],
    // US-07: hot read p95 < 300ms
    profile_get_duration: ['p(95)<300'],
    // Error rate under 1%
    error_rate: ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const TOKEN    = __ENV.TOKEN    || '';

const headers = {
  'Authorization': `Bearer ${TOKEN}`,
  'Content-Type': 'application/json',
};

// Bengaluru city centre ± small random offset to avoid caching all requests at same coords
function randomCoord(base, jitter) {
  return base + (Math.random() - 0.5) * jitter;
}

export default function () {
  // ── Geo-search: GET /donors/nearby-requests ──────────────────────────────────
  const lat = randomCoord(12.9716, 0.05);
  const lng = randomCoord(77.5946, 0.05);

  const geoRes = http.get(
    `${BASE_URL}/donors/nearby-requests?lat=${lat}&lng=${lng}&radius=50`,
    { headers, tags: { name: 'geo_search' } },
  );

  geoSearchDuration.add(geoRes.timings.duration);
  const geoOk = check(geoRes, {
    'geo-search 200': (r) => r.status === 200,
    'returns array': (r) => Array.isArray(JSON.parse(r.body || '[]')),
  });
  errorRate.add(!geoOk);

  // ── Hot read: GET /donors/profile ─────────────────────────────────────────────
  const profileRes = http.get(
    `${BASE_URL}/donors/profile`,
    { headers, tags: { name: 'profile_get' } },
  );

  profileDuration.add(profileRes.timings.duration);
  check(profileRes, {
    'profile 200': (r) => r.status === 200,
  });

  sleep(0.5); // think time between iterations
}

export function handleSummary(data) {
  const p95geo  = data.metrics.geo_search_duration?.values?.['p(95)'] ?? 'N/A';
  const p95prof = data.metrics.profile_get_duration?.values?.['p(95)'] ?? 'N/A';
  const errors  = (data.metrics.error_rate?.values?.rate * 100 ?? 0).toFixed(2);

  console.log(`
=== Performance Summary ===
Geo-search p95:  ${p95geo}ms  (threshold: <500ms)  ${p95geo < 500 ? 'PASS' : 'FAIL'}
Profile read p95: ${p95prof}ms  (threshold: <300ms)  ${p95prof < 300 ? 'PASS' : 'FAIL'}
Error rate:       ${errors}%      (threshold: <1%)     ${parseFloat(errors) < 1 ? 'PASS' : 'FAIL'}
  `);

  return {
    'test/k6/results/geo-search-latest.json': JSON.stringify(data, null, 2),
  };
}
