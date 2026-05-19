/**
 * PM2 Ecosystem Configuration — All 5 VPS Services
 * 
 * Usage:
 *   pm2 start ecosystem.config.js
 *   pm2 reload ecosystem.config.js
 *   pm2 stop all
 *   pm2 logs
 * 
 * Install log rotation:
 *   pm2 install pm2-logrotate
 *   pm2 set pm2-logrotate:max_size 10M
 *   pm2 set pm2-logrotate:retain 7
 *   pm2 set pm2-logrotate:compress true
 */

module.exports = {
  apps: [
    // ─── TrendBrief AI Service ───
    {
      name: "trendbriefai-service",
      script: "dist/index.js",
      cwd: "/opt/trend-brief-ai/trendbriefai-service",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      max_restarts: 10,
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      error_file: "/var/log/pm2/trendbriefai-error.log",
      out_file: "/var/log/pm2/trendbriefai-out.log",
      merge_logs: true,
      time: true,
    },

    // ─── SmartBuy AI Service ───
    {
      name: "smartbuy-service",
      script: "dist/index.js",
      cwd: "/opt/smartbuy-ai/smartbuy-service",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      max_restarts: 10,
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: "production",
        PORT: 3001,
      },
      error_file: "/var/log/pm2/smartbuy-error.log",
      out_file: "/var/log/pm2/smartbuy-out.log",
      merge_logs: true,
      time: true,
    },

    // ─── CareMate AI Service ───
    {
      name: "caremate-service",
      script: "dist/index.js",
      cwd: "/opt/caremate-ai/caremate-service",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      max_restarts: 10,
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: "production",
        PORT: 3002,
      },
      error_file: "/var/log/pm2/caremate-error.log",
      out_file: "/var/log/pm2/caremate-out.log",
      merge_logs: true,
      time: true,
    },

    // ─── FIN Tax AI Service ───
    {
      name: "fin-tax-service",
      script: "dist/index.js",
      cwd: "/opt/fin-tax-ai/fin-tax-service",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      max_restarts: 10,
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: "production",
        PORT: 3003,
      },
      error_file: "/var/log/pm2/fintax-error.log",
      out_file: "/var/log/pm2/fintax-out.log",
      merge_logs: true,
      time: true,
    },

    // ─── Childhood Service (AI Video Engine) ───
    {
      name: "childhood-service",
      script: "dist/index.js",
      cwd: "/opt/ai-video-engine/childhood-service",
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: "500M",
      max_restarts: 10,
      restart_delay: 5000,
      exp_backoff_restart_delay: 100,
      env: {
        NODE_ENV: "production",
        PORT: 3005,
      },
      error_file: "/var/log/pm2/childhood-error.log",
      out_file: "/var/log/pm2/childhood-out.log",
      merge_logs: true,
      time: true,
    },
  ],
};
