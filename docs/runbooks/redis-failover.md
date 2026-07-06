# Runbook: Redis Failover

## When to use
- Primary Redis node is unreachable or OOM-killed
- BullMQ jobs are not being processed
- WebSocket room sync (Socket.io adapter) is failing
- Rate-limit keys are being reset unexpectedly

## Symptoms to check first

```bash
# From the API server
redis-cli -h $REDIS_HOST -p $REDIS_PORT ping   # should return PONG
redis-cli -h $REDIS_HOST info replication        # check role and connected slaves
redis-cli -h $REDIS_HOST info memory             # watch used_memory vs maxmemory
```

---

## Option A: Managed Redis with automatic failover (Redis Cloud / Elasticache)

For managed services, failover is automatic. Your action items:

1. Check the service dashboard for the failover event.
2. Confirm the new primary endpoint — the DNS may have changed.
3. Update `REDIS_URL` in your environment/secrets if the endpoint is not abstracted via a stable CNAME.
4. Restart the API to clear any stale connection pool entries:
   ```bash
   kubectl rollout restart deployment/blood-donation-api
   ```
5. Verify BullMQ is draining:
   ```bash
   redis-cli -h $REDIS_HOST llen bull:matching:wait
   redis-cli -h $REDIS_HOST llen bull:notifications:wait
   ```

---

## Option B: Self-hosted Redis Sentinel / Replication

### Promote a replica to primary

```bash
# On the replica you want to promote
redis-cli -h <replica-host> REPLICAOF NO ONE

# Verify it is now a master
redis-cli -h <replica-host> info replication | grep role
```

### Update application connection

1. Update `REDIS_URL` in `.env.production` (or your secrets manager) to point to the new primary.
2. If using Sentinel, verify the sentinel quorum agrees on the new master:
   ```bash
   redis-cli -h <sentinel-host> -p 26379 SENTINEL master mymaster
   ```
3. Restart the API:
   ```bash
   pm2 restart blood-donation-api
   ```

---

## Option C: Emergency — Redis completely lost, no replica

BullMQ and Socket.io will degrade but the HTTP API remains functional (Prisma queries are not Redis-dependent).

1. Start a fresh Redis instance.
2. Update `REDIS_URL` and restart the API.
3. **Re-queue escalation jobs** for in-flight requests:
   ```sql
   -- Find PENDING requests with no NOTIFIED matches in the last 10 min
   SELECT id FROM "BloodRequest"
   WHERE status = 'PENDING'
     AND "createdAt" > NOW() - INTERVAL '2 hours';
   ```
   Then call the matching service manually or trigger via admin panel for each affected request.

4. WebSocket clients will auto-reconnect on the next push notification (Socket.io reconnection is configured for up to 10 retries with 2 s backoff).

---

## Post-failover checklist

- [ ] `redis-cli ping` returns PONG on new primary
- [ ] BullMQ queues (`matching`, `notifications`) are processing (check Bull Board or queue metrics)
- [ ] Socket.io `/ws` namespace is connectable (`wscat -c ws://api:3000/ws`)
- [ ] Rate-limit keys rebuilt (first requests in a new window will be allowed — acceptable)
- [ ] Sentry: no new `RedisConnectionError` events in the last 5 min

---

**Estimated RTO:** < 5 min (managed, DNS-stable), 15–30 min (self-hosted promotion).
