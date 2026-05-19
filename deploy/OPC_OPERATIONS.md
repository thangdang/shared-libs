# OPC Operations Guide

> One Person Company — Automated operations for 5 AI products
> Zero-touch daily operation after initial setup

---

## Quick Start

### VPS Setup (run once)

```bash
ssh root@<vps-ip>
cd /opt/shared-libs/deploy

# 1. Memory optimization (swap + MongoDB + Redis limits)
bash 09_memory_optimization.sh

# 2. Start services with PM2
pm2 start ecosystem.config.js
pm2 save
pm2 startup

# 3. Install PM2 log rotation
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
pm2 set pm2-logrotate:compress true

# 4. Configure Telegram alerts
cp .telegram.env.example .telegram.env
nano .telegram.env  # Fill in bot token + chat ID

# 5. Set your local PC Tailscale IP
export LOCAL_PC_TAILSCALE_IP=100.x.x.x  # Add to /etc/environment

# 6. Install cron jobs (backup + health check + weekly report)
bash install-cron.sh
```

### Local PC Setup (run once)

```
1. Install Task Scheduler:
   - Open taskschd.msc
   - Import: shared-libs/deploy/windows/install-task-scheduler.xml
   - Or: schtasks /create /tn "WinLux AI Engines" /xml "install-task-scheduler.xml"

2. Test manual start:
   - Double-click: shared-libs/deploy/windows/start-all-engines.bat

3. Backup secrets:
   - Run: shared-libs/deploy/windows/backup-secrets.bat
```

---

## Daily Operations (Automated)

| Time | Action | Script |
|------|--------|--------|
| Every 5 min | Health check all services | `health-check.sh` |
| 3:00 AM | MongoDB backup (7-day retention) | `mongodump-backup.sh` |
| Sunday 9 AM | Weekly status report | `weekly-report.py` |
| On crash | PM2 auto-restart services | `ecosystem.config.js` |
| On reboot | Auto-start AI engines | Task Scheduler |
| Always | Ollama watchdog (restart if dead) | `ollama-watchdog.py` |

**You don't need to do anything daily.** Just check Telegram for alerts.

---

## Manual Operations (When Needed)

### Restart a VPS service
```bash
pm2 restart trendbriefai-service
```

### Restart all VPS services
```bash
pm2 restart all
```

### Check VPS service logs
```bash
pm2 logs trendbriefai-service --lines 50
```

### Check backup status
```bash
ls -la /backup/mongodb/
```

### Force a backup now
```bash
bash /opt/shared-libs/deploy/mongodump-backup.sh
```

### Restart local AI engines (Windows)
```
Double-click: stop-all-engines.bat
Then: start-all-engines.bat
```

### Backup secrets
```
Double-click: backup-secrets.bat
Enter password when prompted
```

---

## Telegram Alerts You'll Receive

| Alert | Meaning | Action |
|-------|---------|--------|
| 🔴 SERVICE DOWN | A service is unreachable | Check VPS: `pm2 status` |
| 🟢 RECOVERED | Service came back online | No action needed |
| 🔴 Backup Failed | MongoDB backup error | SSH to VPS, check disk space |
| 📊 Weekly Report | Sunday summary | Review, no action needed |

---

## Troubleshooting

### VPS out of memory
```bash
free -h                          # Check current usage
pm2 restart all                  # Restart services (frees leaked memory)
sudo systemctl restart mongod    # Restart MongoDB if needed
```

### MongoDB not responding
```bash
sudo systemctl status mongod
sudo systemctl restart mongod
```

### Redis full
```bash
redis-cli INFO memory            # Check usage
redis-cli FLUSHDB                # Clear current DB (careful!)
```

### Local PC: engines not starting
```
1. Check logs: C:\Users\evtxd01\learn_python\logs\
2. Check Ollama: curl http://localhost:11434/api/tags
3. Restart: stop-all-engines.bat → start-all-engines.bat
```

### Tailscale disconnected
```bash
# VPS
tailscale status
tailscale up

# Local PC
# Open Tailscale tray icon → Connect
```

---

## File Reference

```
shared-libs/deploy/
├── ecosystem.config.js          # PM2 config (5 services)
├── mongodump-backup.sh          # Daily backup
├── health-check.sh              # 5-min health monitor
├── weekly-report.py             # Sunday report
├── telegram-notify.sh           # Telegram helper
├── install-cron.sh              # Install all cron jobs
├── 09_memory_optimization.sh    # Swap + MongoDB + Redis config
├── .telegram.env.example        # Telegram credentials template
├── OPC_OPERATIONS.md            # This file
├── windows/
│   ├── start-all-engines.bat    # Start Ollama + 5 engines
│   ├── stop-all-engines.bat     # Stop all engines
│   ├── ollama-watchdog.py       # Ollama health monitor
│   ├── backup-secrets.bat       # Encrypted .env backup
│   └── install-task-scheduler.xml  # Auto-start at login
└── (existing deploy scripts...)
```

---

## Monthly Checklist (5 minutes)

- [ ] Check Telegram weekly reports are arriving
- [ ] Verify backup size is growing (data is being backed up)
- [ ] Refresh Zalo OA tokens (every 90 days)
- [ ] Check VPS disk usage (`df -h`)
- [ ] Run `backup-secrets.bat` after any .env changes
