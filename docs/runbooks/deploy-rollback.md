# Runbook: Deployment Rollback

## When to use
- Error rate spikes after a deploy (check Sentry or logs)
- Health check endpoint returns non-200
- P95 latency exceeds SLO threshold post-deploy
- Critical bug confirmed in production that is not fixable forward

---

## 1. Confirm the deploy is the cause

```bash
# Check when the error spike started vs deploy time
kubectl rollout history deployment/blood-donation-api

# Or if using PM2 with git
git log --oneline -5
```

Compare the deploy timestamp against the first Sentry event or latency spike.

---

## 2. Roll back the API

### Kubernetes

```bash
# Roll back to the previous ReplicaSet
kubectl rollout undo deployment/blood-donation-api

# Verify rollback is complete
kubectl rollout status deployment/blood-donation-api

# Confirm the old image is running
kubectl get pods -l app=blood-donation-api -o jsonpath='{.items[*].spec.containers[*].image}'
```

### PM2 + Git

```bash
# Check what was running before
git log --oneline -3

# Reset to the previous commit
git checkout <previous-commit-sha>
npm run build --workspace=apps/backend
pm2 restart blood-donation-api
```

### Docker Compose

```bash
# Pull the previous image tag (e.g., the one before :latest)
docker pull ghcr.io/your-org/blood-donation-api:<previous-tag>

# Update compose and restart
IMAGE_TAG=<previous-tag> docker compose up -d blood-donation-api
```

---

## 3. Roll back a Prisma migration (if schema changed)

> Only needed if the deploy included a `prisma migrate deploy`.

```bash
# List applied migrations
npx prisma migrate status

# Roll back by reverting the schema and creating a compensating migration
# (Prisma does not support down-migrations natively)

# 1. Revert prisma/schema.prisma to the previous state (git checkout)
git checkout <previous-commit-sha> -- prisma/schema.prisma

# 2. Create a compensating migration
npx prisma migrate dev --name rollback_<migration_name>

# 3. Deploy it to production
npx prisma migrate deploy
```

If the column/table was additive and data exists, be careful not to drop it — prefer making the column nullable rather than dropping, until the data is migrated.

---

## 4. Roll back the mobile app (Expo OTA update)

If the breaking change was shipped via EAS Update (OTA):

```bash
# List recent updates
eas update:list

# Roll back to a previous update branch/channel
eas update:republish --group <previous-update-group-id> --branch production
```

If the breaking change is in a native binary release, users must update via the App Store / Play Store — you cannot force a rollback for installed native builds.

---

## 5. Roll back the admin portal

The admin portal is a static SPA. Re-deploy the previous build:

```bash
# If hosted on Vercel
vercel rollback <previous-deployment-url>

# If hosting static files manually
# Re-upload the previous dist/ to your CDN/S3 bucket
aws s3 sync s3://blood-donation-admin-backup/<previous-build>/ s3://blood-donation-admin/ --delete
```

---

## 6. Post-rollback verification

```bash
# Health check
curl -s https://api.blooddonation.app/health | jq .

# Check error rate is back to baseline (Sentry / logs)
# Check BullMQ queues are processing
redis-cli -h $REDIS_HOST llen bull:matching:wait
```

## 7. Incident write-up

After the rollback is stable:
1. Create a post-mortem issue in the project tracker.
2. Document: what changed, what broke, how it was detected, and time to recovery.
3. Add a regression test before re-attempting the feature.

---

**Estimated RTO (API only):** < 5 min (Kubernetes rollout undo), 10–15 min (PM2/git reset).  
**Estimated RTO (with schema rollback):** 20–40 min depending on data volume.
