# Runbook: Deploy & Rollback (Hostinger VPS)

## Normal Deploy (automated)

Every push to `main` that passes CI triggers the `deploy-production` workflow:

1. GitHub Actions SSH-deploys to the VPS: pull → `npm ci` → `prisma migrate deploy` → `npm run build` → `pm2 reload --update-env`
2. Health check at `$VPS_HEALTH_URL` — must return HTTP 200
3. Automatic rollback if health check fails (reverts to previous git commit + rebuild + reload)

The deploy requires **manual approval** from the `production` GitHub Environment. Check **Actions → deploy-production** to approve.

---

## Manual Deploy (emergency / hotfix)

SSH to the VPS as the deploy user:

```bash
ssh deploy@<VPS_IP>
cd ~/blood-donation

# Save rollback point
PREV=$(git rev-parse HEAD)

# Pull, install, build
git pull origin main
npm ci --workspace=apps/backend
npx prisma generate --schema=prisma/schema.prisma
export $(grep -v '^#' /etc/blood-donation/.env | xargs)
npx prisma migrate deploy --schema=prisma/schema.prisma
npm run build --workspace=apps/backend

# Reload both processes (zero-downtime)
pm2 reload ecosystem.config.js --update-env

# Health check
curl -sf https://api.yourdomain.com/health | jq .
```

---

## Rollback

### Option A — code-only rollback (no schema change)

```bash
ssh deploy@<VPS_IP>
cd ~/blood-donation

git checkout <PREV_COMMIT_SHA>
npm run build --workspace=apps/backend
pm2 reload ecosystem.config.js --update-env

# Confirm
curl -sf https://api.yourdomain.com/health | jq .
```

### Option B — with schema rollback (migration included in bad deploy)

Prisma does not support down-migrations natively.

```bash
# 1. Revert the schema file to the previous state
git checkout <PREV_COMMIT_SHA> -- prisma/schema.prisma

# 2. Create a compensating migration
#    (use dev machine with access to a copy of the prod DB, or a staging DB)
npx prisma migrate dev --name rollback_<migration_name>

# 3. Deploy the compensating migration to production
DATABASE_URL=<NEON_URL> npx prisma migrate deploy --schema=prisma/schema.prisma

# 4. Rebuild and reload
npm run build --workspace=apps/backend
pm2 reload ecosystem.config.js --update-env
```

> If the failing migration was **additive** (added a nullable column), prefer
> leaving the column in place and rolling back only the code. Drop or rename
> only when you are certain no data has been written to it.

---

## Process Management

```bash
# Status of both processes
pm2 status

# Live logs (Ctrl+C to exit)
pm2 logs blood-api
pm2 logs blood-worker

# Restart a single process (hard restart, brief downtime)
pm2 restart blood-api
pm2 restart blood-worker

# Graceful reload (zero-downtime — preferred)
pm2 reload blood-api
pm2 reload blood-worker

# Reload both from ecosystem file
pm2 reload ecosystem.config.js --update-env
```

---

## Health & Diagnostics

```bash
# API health (checks DB + Redis)
curl -s https://api.yourdomain.com/health | jq .

# BullMQ queue depth (jobs waiting)
redis-cli -u "$REDIS_URL" llen "bull:MATCH_REQUESTS:wait"

# Prisma migration status
npx prisma migrate status --schema=/home/deploy/blood-donation/prisma/schema.prisma

# Nginx status
systemctl status nginx

# PM2 process memory
pm2 monit
```

---

## Estimated Recovery Times

| Scenario | RTO |
|---|---|
| Code-only rollback (no migration) | < 5 min |
| With compensating schema migration | 20–40 min |
| Full VPS rebuild from scratch | ~2 hours (see migration-hostinger.md) |

---

## Post-Rollback Checklist

1. `curl -sf https://api.yourdomain.com/health | jq .` → `"status":"ok"`
2. `pm2 status` → both processes `online`, restart count not climbing
3. Sentry error rate back to baseline
4. BullMQ queue depth normal (`llen bull:MATCH_REQUESTS:wait` ≈ 0)
5. Create a post-mortem issue: what changed, what broke, detection time, RTO
6. Add a regression test before re-attempting the reverted feature
