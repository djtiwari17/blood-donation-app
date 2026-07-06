# Runbook: PostgreSQL Database Restore (PITR)

## When to use
- Accidental data deletion or corruption
- Failed migration that cannot be rolled forward
- Data consistency violation discovered after deploy

## Prerequisites
- Access to the PostgreSQL server or managed DB console (RDS / Supabase / Neon)
- `psql` or equivalent CLI available
- Backup/WAL archive access confirmed

---

## 1. Identify the target restore point

Find the last known-good timestamp:

```bash
# Check application logs for the last successful write before the incident
grep "POST /v1" /var/log/app/access.log | tail -50

# Or query the WAL archive listing (RDS example)
aws rds describe-db-snapshots --db-instance-identifier blood-donation-prod
```

## 2. Stop application traffic

```bash
# Scale down the API so no new writes land during restore
kubectl scale deployment blood-donation-api --replicas=0
# OR for PM2:
pm2 stop blood-donation-api
```

## 3. Restore (managed DB — RDS / Supabase)

### RDS point-in-time recovery
```bash
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier blood-donation-prod \
  --target-db-instance-identifier blood-donation-restore \
  --restore-time 2024-01-15T10:30:00Z
```

Wait for the restore instance to be `available`, then update `DATABASE_URL` to point to the new instance.

### Self-hosted PostgreSQL (WAL-G / pgBackRest)
```bash
# Stop PostgreSQL
systemctl stop postgresql

# Restore base backup
wal-g backup-fetch /var/lib/postgresql/data LATEST

# Create recovery signal
touch /var/lib/postgresql/data/recovery.signal

# Set target time in postgresql.conf
echo "recovery_target_time = '2024-01-15 10:30:00 UTC'" >> /var/lib/postgresql/data/postgresql.conf
echo "recovery_target_action = 'promote'" >> /var/lib/postgresql/data/postgresql.conf

# Start and let it replay WAL to the target time
systemctl start postgresql
```

## 4. Verify data integrity

```sql
-- Check row counts against pre-incident metrics
SELECT COUNT(*) FROM "User";
SELECT COUNT(*) FROM "BloodRequest";
SELECT COUNT(*) FROM "BloodMatch" WHERE status = 'DONATED';

-- Confirm the target time was reached
SELECT now();
```

## 5. Run pending migrations (if any were applied before incident)

```bash
cd apps/backend
npx prisma migrate deploy
```

## 6. Restart application

```bash
kubectl scale deployment blood-donation-api --replicas=3
# OR
pm2 start blood-donation-api
```

## 7. Smoke test

```bash
curl -s https://api.blooddonation.app/health | jq .
```

## Rollback if restore fails

If the restored instance is also corrupt, restore to an earlier snapshot:
```bash
aws rds describe-db-snapshots --db-instance-identifier blood-donation-prod \
  --query 'DBSnapshots[*].[SnapshotCreateTime,DBSnapshotIdentifier]' \
  --output table
```

Repeat step 3 with an earlier `--restore-time` or a specific snapshot identifier.

---

**Estimated RTO:** 30–60 min for managed DB, 60–120 min for self-hosted.  
**Estimated RPO:** Up to 5 min (continuous WAL archiving), up to 24 h (daily snapshots only).
