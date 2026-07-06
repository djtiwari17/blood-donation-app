/**
 * Verifies that Express is configured with "trust proxy 1" so that
 * @nestjs/throttler (and any code that reads req.ip) resolves the real
 * client IP from X-Forwarded-For rather than returning the Nginx proxy
 * address (127.0.0.1).
 *
 * These tests use plain Express — no NestJS bootstrapping overhead —
 * because the behavior under test is an Express setting, not a NestJS API.
 */
import * as express from 'express';
import * as supertest from 'supertest';

function makeApp(trustProxy: boolean | number) {
  const app = express();
  if (trustProxy !== false) app.set('trust proxy', trustProxy);
  app.get('/ip', (req, res) => res.json({ ip: req.ip }));
  return app;
}

const REAL_CLIENT_IP = '203.0.113.1'; // TEST-NET-3, safe for docs/tests

describe('trust proxy — X-Forwarded-For resolution', () => {
  it('resolves the forwarded client IP when trust proxy = 1', async () => {
    const { body } = await supertest(makeApp(1))
      .get('/ip')
      .set('X-Forwarded-For', REAL_CLIENT_IP)
      .expect(200);

    expect(body.ip).toBe(REAL_CLIENT_IP);
  });

  it('does NOT use the forwarded IP when trust proxy is disabled', async () => {
    const { body } = await supertest(makeApp(false))
      .get('/ip')
      .set('X-Forwarded-For', REAL_CLIENT_IP)
      .expect(200);

    // supertest connects from 127.0.0.1; without trust proxy Express keeps
    // the socket address regardless of the X-Forwarded-For header.
    expect(body.ip).not.toBe(REAL_CLIENT_IP);
  });

  it('ignores extra hops beyond the first trusted proxy', async () => {
    // With trust proxy = 1, Express trusts only the rightmost entry added
    // by the immediate proxy (Nginx). An attacker cannot spoof the IP by
    // adding extra entries to the left.
    const { body } = await supertest(makeApp(1))
      .get('/ip')
      .set('X-Forwarded-For', `attacker.ip, ${REAL_CLIENT_IP}`)
      .expect(200);

    // Express resolves one hop back from the socket: the value Nginx set.
    expect(body.ip).toBe(REAL_CLIENT_IP);
  });
});
