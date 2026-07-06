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
 *   PM2 reads env_file at start/reload; never commit real .env to git.
 */

const ENV_FILE = '/etc/blood-donation/.env';
const LOG_DIR = '/var/log/blood-donation';

const COMMON = {
  interpreter: 'node',
  exec_mode: 'fork',
  instances: 1,
  env_file: ENV_FILE,
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
