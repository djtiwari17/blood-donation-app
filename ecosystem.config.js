/**
 * PM2 Ecosystem Configuration — Blood Donation App (Hostinger VPS)
 *
 * Two managed processes:
 *   blood-api    — NestJS HTTP + WebSocket server (port 3000, Nginx-proxied)
 *   blood-worker — BullMQ processor + cron scheduler (port 3001, localhost-only)
 *
 * Deploy:
 *   pm2 start ecosystem.config.js          # first start
 *   pm2 reload ecosystem.config.js --update-env  # zero-downtime reload after deploy
 *   pm2 save                               # persist after reboot
 *
 * Environment:
 *   Secrets live in /etc/blood-donation/.env (chmod 600, owned by deploy user).
 *   PM2 has no built-in "env_file" option — this file is parsed manually below
 *   and injected via the standard `env` key so both processes get it at
 *   start/reload time. Never commit the real .env to git.
 */

const fs = require('fs');

const ENV_FILE = '/etc/blood-donation/.env';
const LOG_DIR = '/var/log/blood-donation';

function loadEnvFile(filePath) {
  const env = {};
  if (!fs.existsSync(filePath)) return env;
  for (const line of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const COMMON = {
  interpreter: 'node',
  exec_mode: 'fork',
  instances: 1,
  env: loadEnvFile(ENV_FILE),
  max_memory_restart: '512M',
  restart_delay: 3000,
  max_restarts: 10,
  min_uptime: '10s',
  merge_logs: true,
  time: true,
};

module.exports = {
  apps: [
    {
      ...COMMON,
      name: 'blood-api',
      script: 'apps/backend/dist/main.js',
      out_file: `${LOG_DIR}/api-out.log`,
      error_file: `${LOG_DIR}/api-error.log`,
      log_file: `${LOG_DIR}/api.log`,
    },
    {
      ...COMMON,
      name: 'blood-worker',
      script: 'apps/backend/dist/worker.js',
      out_file: `${LOG_DIR}/worker-out.log`,
      error_file: `${LOG_DIR}/worker-error.log`,
      log_file: `${LOG_DIR}/worker.log`,
    },
  ],
};
