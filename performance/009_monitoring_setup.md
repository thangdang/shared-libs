# Monitoring & Alerting Setup Guide

> Operational guide for setting up monitoring on the WinLux VPS (4GB DigitalOcean droplet).
> Covers infrastructure alerts, uptime monitoring, and PM2 process management.

---

## 1. DigitalOcean Alerts (Manual Setup in Dashboard)

Navigate to: **DigitalOcean Dashboard → Monitoring → Create Alert Policy**

### CPU Alert

| Setting | Value |
|---------|-------|
| Resource | Your droplet |
| Metric | CPU utilization |
| Threshold | > 80% |
| Duration | 5 minutes |
| Notification | Email (team@winlux.com) |

### RAM Alert

| Setting | Value |
|---------|-------|
| Resource | Your droplet |
| Metric | Memory utilization |
| Threshold | > 3.5 GB (87.5% of 4 GB) |
| Duration | 5 minutes |
| Notification | Email (team@winlux.com) |

### Disk Alert

| Setting | Value |
|---------|-------|
| Resource | Your droplet |
| Metric | Disk utilization |
| Threshold | > 70% |
| Duration | 5 minutes |
| Notification | Email (team@winlux.com) |

### Setup Steps

1. Go to https://cloud.digitalocean.com/monitoring
2. Click "Create Alert Policy"
3. Select your droplet
4. Configure each alert as above
5. Add email notification channel
6. Verify alerts are active in the Alerts tab

---

## 2. UptimeRobot Monitors (Free Tier — 50 monitors)

Sign up at https://uptimerobot.com (free tier supports 50 monitors, 5-min check interval).

### API Health Endpoints (Keyword Monitoring)

| Monitor Name | URL | Type | Keyword |
|-------------|-----|------|---------|
| TrendBrief API | https://api.winlux.com/trendbriefai/health | Keyword | "ok" |
| SmartBuy API | https://api.winlux.com/smartbuy/health | Keyword | "ok" |
| CareMate API | https://api.winlux.com/caremate/health | Keyword | "ok" |
| FIN Tax API | https://api.winlux.com/fintax/health | Keyword | "ok" |
| Video Engine API | https://api.winlux.com/video/health | Keyword | "ok" |

### Frontend Availability (HTTP Monitoring)

| Monitor Name | URL | Type | Expected |
|-------------|-----|------|----------|
| TrendBrief UI | https://trendbriefai.winlux.com | HTTP(s) | 200 |
| SmartBuy UI | https://smartbuy.winlux.com | HTTP(s) | 200 |
| CareMate UI | https://caremate.winlux.com | HTTP(s) | 200 |
| FIN Tax UI | https://fintax.winlux.com | HTTP(s) | 200 |

### Setup Steps

1. Create account at https://uptimerobot.com
2. Click "Add New Monitor" for each entry above
3. For API monitors: select "Keyword" type, enter URL, set keyword to `ok`
4. For frontend monitors: select "HTTP(s)" type, enter URL
5. Set alert contacts (email + optional Telegram/Slack webhook)
6. Set check interval to 5 minutes (free tier default)

### Alert Contacts

Configure notifications to go to:
- Email: team@winlux.com
- Optional: Telegram bot via webhook integration
- Optional: Slack channel via webhook

---

## 3. PM2 Process Monitoring

PM2 is already running all Node.js services. Use these commands for real-time monitoring.

### Real-time Monitoring

```bash
# Dashboard view — CPU, RAM, event loop per process
pm2 monit

# Quick status overview
pm2 status

# Detailed info for a specific service
pm2 describe smartbuy-service
```

### Log Management

```bash
# View recent logs (all services)
pm2 logs --lines 100

# View logs for a specific service
pm2 logs smartbuy-service --lines 50

# Flush all logs (when disk is filling up)
pm2 flush
```

### Restart & Recovery

```bash
# Restart all services
pm2 restart all

# Restart a specific service
pm2 restart smartbuy-service

# Reload with zero-downtime (cluster mode)
pm2 reload all

# Stop a problematic service
pm2 stop fin-tax-service
```

### Memory Monitoring

```bash
# Check memory usage per process
pm2 jlist | python3 -c "
import json, sys
procs = json.load(sys.stdin)
for p in procs:
    name = p['name']
    mem = p['monit']['memory'] / 1024 / 1024
    cpu = p['monit']['cpu']
    print(f'{name:25s} RAM: {mem:6.1f} MB  CPU: {cpu}%')
"
```

### Auto-restart on Memory Threshold

In `ecosystem.config.js`, add memory limit to auto-restart leaky processes:

```javascript
module.exports = {
  apps: [
    {
      name: 'smartbuy-service',
      script: 'dist/index.js',
      max_memory_restart: '512M', // Restart if exceeds 512MB
      // ...other config
    }
  ]
};
```

---

## 4. Quick Troubleshooting Runbook

### Service is down (UptimeRobot alert)

```bash
ssh root@your-vps
pm2 status                    # Check which service is stopped/errored
pm2 logs <service> --lines 50 # Check error logs
pm2 restart <service>         # Restart it
```

### High CPU alert (DigitalOcean)

```bash
pm2 monit                     # Identify which process is using CPU
top -o %CPU                   # System-wide view
# If a specific service is stuck:
pm2 restart <service>
```

### High RAM alert (DigitalOcean)

```bash
pm2 jlist | python3 -c "..."  # (memory script above)
free -h                        # System memory overview
# If Redis is bloated:
redis-cli info memory
redis-cli dbsize
```

### Disk space alert (DigitalOcean)

```bash
df -h                          # Check disk usage
du -sh /var/log/*              # Find large log files
pm2 flush                      # Clear PM2 logs
journalctl --vacuum-size=100M  # Trim systemd logs
```

---

## 5. Optional: PM2 Plus (Paid Monitoring Dashboard)

For a web-based dashboard with historical metrics:

```bash
pm2 plus  # Follow prompts to link to PM2 dashboard
```

Free tier includes:
- 1 server, 4 processes
- 24h log retention
- Basic alerting

For the free alternative, the combination of DigitalOcean alerts + UptimeRobot + `pm2 monit` covers all essential monitoring needs.
