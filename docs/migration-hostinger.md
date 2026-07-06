# Migration Guide: Railway → Hostinger VPS

**Scope:** Move the NestJS API and BullMQ worker to a Hostinger KVM VPS.
Neon Postgres and Upstash Redis are **kept as managed services** — only the
Node.js processes move.

Replace every occurrence of `api.yourdomain.com` with your actual API subdomain
before running any command.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [VPS Initial Setup](#2-vps-initial-setup)
3. [Firewall (ufw + fail2ban)](#3-firewall-ufw--fail2ban)
4. [Install Software Stack](#4-install-software-stack)
5. [Create Deploy User & Directory Structure](#5-create-deploy-user--directory-structure)
6. [Clone, Build, and Migrate](#6-clone-build-and-migrate)
7. [Environment File (secrets)](#7-environment-file-secrets)
8. [PM2 Setup](#8-pm2-setup)
9. [Nginx Reverse Proxy](#9-nginx-reverse-proxy)
10. [TLS / Let's Encrypt (TLS 1.3)](#10-tls--lets-encrypt-tls-13)
11. [DNS Configuration](#11-dns-configuration)
12. [unattended-upgrades & logrotate](#12-unattended-upgrades--logrotate)
13. [GitHub Actions Secrets](#13-github-actions-secrets)
14. [Post-Migration Verification Checklist](#14-post-migration-verification-checklist)
15. [Monitoring & Alerting](#15-monitoring--alerting)

---

## 1. Prerequisites

| Item | Requirement |
|---|---|
| VPS | Ubuntu 22.04 LTS, KVM, ≥ 2 vCPU / 2 GB RAM, root SSH access |
| Domain | A subdomain pointed at the VPS IP (e.g. `api.yourdomain.com`) |
| Neon Postgres | Production database URL already working (`DATABASE_URL`) |
| Upstash Redis | Production Redis URL already working (`REDIS_URL`, `rediss://`) |
| GitHub repo | Repository with this codebase and Actions enabled |
| Local SSH key | `ssh-keygen -t ed25519 -C "blood-donation-deploy"` — the public key goes on the VPS, private key goes into GitHub Secrets |

---

## 2. VPS Initial Setup

Run as **root** via the Hostinger VPS console or initial root SSH session.

```bash
# Update system packages
apt-get update && apt-get upgrade -y

# Set timezone (adjust if needed)
timedatectl set-timezone Asia/Kolkata

# Disable root password login (key-only SSH)
sed -i \
  -e 's/^#\?PermitRootLogin.*/PermitRootLogin prohibit-password/' \
  -e 's/^#\?PasswordAuthentication.*/PasswordAuthentication no/' \
  /etc/ssh/sshd_config
systemctl restart ssh
```

---

## 3. Firewall (ufw + fail2ban)

```bash
# ufw — allow SSH, HTTP, HTTPS only
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp   comment 'SSH'
ufw allow 80/tcp   comment 'HTTP (Nginx → HTTPS redirect)'
ufw allow 443/tcp  comment 'HTTPS'
ufw --force enable
ufw status verbose

# fail2ban — brute-force SSH protection
apt-get install -y fail2ban
systemctl enable --now fail2ban

# Verify no other ports are exposed
ss -tlnp
```

> Port 3000 (API) and 3001 (worker) are **not** opened in ufw. They are bound
> to 127.0.0.1 and only reachable through Nginx on the loopback interface.

---

## 4. Install Software Stack

```bash
# Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs
node --version   # should print v20.x.x

# PM2 (process manager)
npm install -g pm2
pm2 --version

# Nginx
apt-get install -y nginx
systemctl enable nginx

# Certbot (Let's Encrypt)
apt-get install -y certbot python3-certbot-nginx
```

---

## 5. Create Deploy User & Directory Structure

```bash
# Create non-root deploy user
useradd -m -s /bin/bash deploy

# Authorise the deploy SSH key (replace with your actual public key)
mkdir -p /home/deploy/.ssh
cat >> /home/deploy/.ssh/authorized_keys << 'EOF'
ssh-ed25519 AAAA... blood-donation-deploy
EOF
chmod 700 /home/deploy/.ssh
chmod 600 /home/deploy/.ssh/authorized_keys
chown -R deploy:deploy /home/deploy/.ssh

# App log directory
mkdir -p /var/log/blood-donation
chown deploy:deploy /var/log/blood-donation

# Secrets directory (created in step 7)
mkdir -p /etc/blood-donation
```

---

## 6. Clone, Build, and Migrate

Switch to the **deploy user** for all remaining app commands:

```bash
su - deploy

# Clone the repository
git clone https://github.com/YOUR_ORG/blood-donation-app.git ~/blood-donation
cd ~/blood-donation

# Install backend dependencies
npm ci --workspace=apps/backend

# Generate Prisma client
npx prisma generate --schema=prisma/schema.prisma

# Fix @prisma/client resolution for the compiled runtime: schema.prisma's
# custom `output` generates the real client into
# apps/backend/node_modules/.prisma/client, but the hoisted @prisma/client
# package resolves `.prisma/client` from its own location first, finding a
# stale/empty stub at root node_modules/.prisma/client instead (Jest tests
# dodge this via moduleNameMapper; `node dist/main.js` does not).
rm -rf node_modules/.prisma/client
ln -s ../../apps/backend/node_modules/.prisma/client node_modules/.prisma/client

# Build (produces apps/backend/dist/)
npm run build --workspace=apps/backend

# Verify both entry points exist
ls apps/backend/dist/main.js apps/backend/dist/worker.js
```

---

## 7. Environment File (secrets)

Back as **root**:

```bash
# Copy the example and fill in production values
cp /home/deploy/blood-donation/.env.example /etc/blood-donation/.env
nano /etc/blood-donation/.env

# Lock down permissions — only deploy user can read it
chmod 600 /etc/blood-donation/.env
chown deploy:deploy /etc/blood-donation/.env
```

**Every variable in `.env.example` is required in production.** Key values to
set correctly:

| Variable | Value |
|---|---|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon connection string with `?sslmode=require` |
| `REDIS_URL` | Upstash `rediss://` URL (note double-s) |
| `CORS_ORIGIN` | Mobile app origin or `*` for public API |
| `JWT_PRIVATE_KEY` | Base64-encoded RSA-2048 private PEM |
| `JWT_PUBLIC_KEY` | Base64-encoded RSA-2048 public PEM |
| `SMS_PROVIDER` | `msg91` |
| `SENTRY_ENVIRONMENT` | `production` |
| `ADMIN_ALLOWED_IPS` | Your office / VPN CIDRs |

As the **deploy user**, run the initial migration:

```bash
export $(grep -v '^#' /etc/blood-donation/.env | xargs)
npx prisma migrate deploy --schema=/home/deploy/blood-donation/prisma/schema.prisma
```

---

## 8. PM2 Setup

As the **deploy user**:

```bash
cd ~/blood-donation

# Start both processes
pm2 start ecosystem.config.js

# Verify both are running
pm2 status
pm2 logs --lines 50

# Persist PM2 process list across reboots
pm2 save
```

As **root**, set up the PM2 systemd startup unit:

```bash
# PM2 will print a command — run it exactly as shown
pm2 startup systemd -u deploy --hp /home/deploy
# Example output:
#   sudo systemctl enable pm2-deploy
# Run that command now.
```

Verify restart-on-reboot:

```bash
systemctl status pm2-deploy
reboot
# After reboot:
su - deploy -c "pm2 status"
```

---

## 9. Nginx Reverse Proxy

Create `/etc/nginx/sites-available/blood-donation`:

```nginx
# ── HTTP → HTTPS redirect ────────────────────────────────────────────────────
server {
    listen 80;
    listen [::]:80;
    server_name api.yourdomain.com;

    # Allow certbot ACME challenge through
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$host$request_uri;
    }
}

# ── HTTPS + WebSocket proxy ──────────────────────────────────────────────────
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name api.yourdomain.com;

    # Certificates (filled in by certbot)
    ssl_certificate     /etc/letsencrypt/live/api.yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.yourdomain.com/privkey.pem;

    # TLS 1.3 only — meets Blueprint NFR §9
    ssl_protocols TLSv1.3;
    ssl_prefer_server_ciphers off;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Security headers
    add_header Strict-Transport-Security "max-age=63072000; includeSubDomains; preload" always;
    add_header X-Content-Type-Options    nosniff                                          always;
    add_header X-Frame-Options           DENY                                             always;
    add_header Referrer-Policy           "no-referrer"                                    always;

    # Proxy to NestJS API (port 3000)
    location / {
        proxy_pass         http://127.0.0.1:3000;
        proxy_http_version 1.1;

        # Real-IP headers — required for trust proxy / rate limiting to work
        proxy_set_header   Host              $host;
        proxy_set_header   X-Real-IP         $remote_addr;
        proxy_set_header   X-Forwarded-For   $proxy_add_x_forwarded_for;
        proxy_set_header   X-Forwarded-Proto $scheme;

        # WebSocket upgrade (Socket.io /ws namespace)
        proxy_set_header   Upgrade           $http_upgrade;
        proxy_set_header   Connection        "upgrade";

        # Timeouts
        proxy_connect_timeout 10s;
        proxy_read_timeout    86400s;  # keep WebSocket connections alive
        proxy_send_timeout    10s;

        # Buffer tuning for API responses
        proxy_buffering    on;
        proxy_buffer_size  16k;
        proxy_buffers      4 32k;
    }
}
```

Enable and test:

```bash
ln -s /etc/nginx/sites-available/blood-donation /etc/nginx/sites-enabled/
nginx -t
systemctl reload nginx
```

> **Port 3001 (worker)** must NOT have a location block — it is localhost-only
> and handles no inbound traffic from Nginx.

---

## 10. TLS / Let's Encrypt (TLS 1.3)

Ensure the DNS A record is live (step 11) before running certbot.

```bash
# Issue certificate
certbot --nginx -d api.yourdomain.com \
  --non-interactive --agree-tos -m your@email.com

# Test auto-renewal
certbot renew --dry-run

# Certbot installs a systemd timer automatically; verify it
systemctl list-timers | grep certbot
```

After certbot runs, reload Nginx:

```bash
nginx -t && systemctl reload nginx
```

Confirm TLS 1.3 is the only accepted version:

```bash
# Should succeed (TLS 1.3)
openssl s_client -connect api.yourdomain.com:443 -tls1_3 </dev/null 2>&1 | grep "Protocol"

# Should fail (TLS 1.2 disabled)
openssl s_client -connect api.yourdomain.com:443 -tls1_2 </dev/null 2>&1 | grep "handshake failure"
```

---

## 11. DNS Configuration

In your DNS provider (Hostinger, Cloudflare, etc.):

| Type | Name | Value | TTL |
|---|---|---|---|
| A | `api` | `<VPS public IP>` | 300 (raise to 3600 once stable) |

Verify propagation:

```bash
dig api.yourdomain.com +short
# Should return your VPS IP
```

---

## 12. unattended-upgrades & logrotate

### Automatic security patches

```bash
apt-get install -y unattended-upgrades
dpkg-reconfigure --priority=low unattended-upgrades
# Answer "Yes" to automatic security updates
```

### Log rotation for app logs

Create `/etc/logrotate.d/blood-donation`:

```
/var/log/blood-donation/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    sharedscripts
    postrotate
        su - deploy -c "pm2 reloadLogs" > /dev/null 2>&1 || true
    endscript
}
```

Test:

```bash
logrotate --debug /etc/logrotate.d/blood-donation
```

---

## 13. GitHub Actions Secrets

Add these secrets in **GitHub → repository → Settings → Secrets and variables → Actions**:

| Secret | Value |
|---|---|
| `VPS_HOST` | VPS public IP address |
| `VPS_USER` | `deploy` |
| `VPS_SSH_KEY` | Contents of the **private** ed25519 key (begins `-----BEGIN OPENSSH PRIVATE KEY-----`) |
| `VPS_HEALTH_URL` | `https://api.yourdomain.com/health` |
| `DATABASE_URL_PROD` | Neon production connection string |
| `JWT_PRIVATE_KEY_TEST` | Base64 RSA private key for CI unit tests |
| `JWT_PUBLIC_KEY_TEST` | Base64 RSA public key for CI unit tests |

The deploy job (`deploy-production`) requires the **production** GitHub Environment
with manual approval enabled:

```
GitHub → repository → Settings → Environments → New environment → "production"
→ Required reviewers: add yourself
```

---

## 14. Post-Migration Verification Checklist

Run these checks immediately after first successful deploy and after every
infrastructure change.

### Layer 1 — Process health

```bash
# Both processes running and stable
pm2 status

# API health endpoint (checks DB + Redis)
curl -s https://api.yourdomain.com/health | jq .
# Expected: {"status":"ok","db":"ok","redis":"ok",...}
```

### Layer 2 — TLS

```bash
# TLS 1.3 enforced
openssl s_client -connect api.yourdomain.com:443 -tls1_3 </dev/null 2>&1 | grep "Protocol"

# HSTS header present
curl -sI https://api.yourdomain.com/health | grep -i strict-transport
```

### Layer 3 — Trusted proxy / real IP

```bash
# Replace <your-public-ip> with your current WAN IP (check ifconfig.me)
curl -s https://api.yourdomain.com/health -H "X-Forwarded-For: 1.2.3.4" | jq .
# The API logs should show your real IP, NOT 127.0.0.1.
# Check: pm2 logs blood-api --lines 10
```

### Layer 4 — WebSocket

```bash
# Install wscat: npm install -g wscat
# Obtain a valid access token first, then:
wscat -c "wss://api.yourdomain.com/ws" \
  --header "Authorization: Bearer <access_token>"
# Should connect and respond to {"event":"ping","data":{}}  →  pong
```

### Layer 5 — Rate limits (§9.3) ★ re-run required

Rate limits depend on correct IP resolution. Re-run this layer against the
Hostinger box, not Railway, to confirm the proxy layer doesn't break them.

```bash
# Send OTP 6 times with the same phone — 6th call must return 429
for i in {1..6}; do
  curl -s -X POST https://api.yourdomain.com/v1/auth/send-otp \
    -H "Content-Type: application/json" \
    -d '{"phone":"+919999999999"}' | jq .statusCode
done
# Expected: 200 200 200 200 200 429
```

If the 6th call does NOT return 429, trust proxy is not working — verify
`app.getHttpAdapter().getInstance().set('trust proxy', 1)` is present in
`apps/backend/src/main.ts` and that Nginx sets `X-Forwarded-For`.

### Layer 6 — k6 geo-search performance ★ re-run required

The proxy/network layer on Hostinger differs from Railway. Re-run the k6 load
test against the new box to confirm p95 targets still pass.

```bash
# From a machine with k6 installed (https://k6.io/docs/get-started/installation)
# Set K6_API_URL to your new Hostinger endpoint
K6_API_URL=https://api.yourdomain.com \
  k6 run test/k6/geo-search.k6.js

# Pass criteria (from Blueprint §8 / NFR):
#   geo-search p95 < 500ms
#   hot reads   p95 < 300ms
```

If p95 targets are missed, check:
1. Neon connection pool (use `?connection_limit=10&pool_timeout=10` in DATABASE_URL)
2. Upstash Redis latency (verify `rediss://` TLS is used, add `?family=6` if IPv6 issues)
3. PostGIS GIST index still present: `\d donor_profiles` in psql

### Layer 7 — BullMQ worker

```bash
# Trigger a match job and confirm it is processed
# Create a blood request via the API, then check worker logs:
pm2 logs blood-worker --lines 20
# Should show: "Processing job X: requestId=... radius=...km"
```

### Layer 8 — Firewall

```bash
# Only ports 22, 80, 443 should be open externally
nmap -p- --open api.yourdomain.com
# Expected: 22/tcp, 80/tcp, 443/tcp
```

---

## 15. Monitoring & Alerting

These services from the existing stack need no changes — just update the URL
they monitor:

| Service | Action |
|---|---|
| **UptimeRobot** | Update monitor URL from `*.railway.app` to `https://api.yourdomain.com/health` |
| **Sentry** | `SENTRY_ENVIRONMENT=production` is already set in `.env` — no change |
| **Grafana Cloud** | Update `GRAFANA_PROMETHEUS_URL` scrape target if applicable |

---

## Estimated Migration Time

| Phase | Time |
|---|---|
| Steps 2–5 (VPS setup) | ~30 min |
| Steps 6–8 (deploy + PM2) | ~20 min |
| Steps 9–10 (Nginx + TLS) | ~15 min |
| Steps 11–13 (DNS + CI secrets) | ~10 min |
| Step 14 (verification) | ~30 min |
| **Total** | **~1.5 hours** |

DNS propagation (step 11) can take up to 30 minutes — start it early.
