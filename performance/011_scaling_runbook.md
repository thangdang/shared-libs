# VPS Scaling Runbook — Task 26

> When to upgrade, what to check first, optimization before scaling
> Current: DigitalOcean 4GB RAM / 2 vCPU / 80GB SSD ($24/mo)

---

## Decision Tree: Do I Need to Upgrade?

```
Alert triggered (CPU/RAM/Disk)
    │
    ├── Is it a spike (< 5 min)? → Ignore, likely crawl batch or FAISS rebuild
    │
    ├── Is it sustained (> 15 min)?
    │       │
    │       ├── Check: Is one service leaking memory?
    │       │     → pm2 restart <service> (fixes most issues)
    │       │
    │       ├── Check: Is MongoDB using too much RAM?
    │       │     → Verify WiredTiger cache is 1GB (not default 2GB)
    │       │     → Run: mongosh --eval 'db.serverStatus().wiredTiger.cache'
    │       │
    │       ├── Check: Is Redis bloated?
    │       │     → redis-cli INFO memory
    │       │     → If > 512MB: check for missing TTLs (redis-cli --bigkeys)
    │       │
    │       └── All optimized but still high?
    │             → UPGRADE VPS
    │
    └── Is it disk space?
          → pm2 flush (clear logs)
          → journalctl --vacuum-size=100M
          → Run archival script: mongosh smartbuy < 010_data_archival.js
          → Still > 70%? → Add DigitalOcean Volume ($10/100GB)
```

---

## Optimization Checklist (Before Upgrading)

Run these checks first — they're free and often fix the issue:

| # | Check | Command | Fix |
|---|-------|---------|-----|
| 1 | MongoDB cache | `mongosh --eval 'db.serverStatus().wiredTiger.cache["maximum bytes configured"]'` | Should be ~1GB, not 2GB |
| 2 | Redis memory | `redis-cli INFO memory \| grep used_memory_human` | Should be < 512MB |
| 3 | PM2 memory | `pm2 jlist` (check per-process) | Restart if any > 300MB |
| 4 | Nginx logs | `du -sh /var/log/nginx/` | Rotate: `logrotate -f /etc/logrotate.d/nginx` |
| 5 | MongoDB logs | `du -sh /var/log/mongodb/` | Rotate or truncate |
| 6 | Disk usage | `df -h` + `du -sh /opt/*/node_modules` | Remove unused node_modules |
| 7 | Slow queries | `mongosh --eval 'db.system.profile.find().sort({ts:-1}).limit(5)'` | Add missing indexes |

---

## Upgrade Path

| Trigger | Current | Upgrade To | New Cost | When |
|---------|---------|-----------|----------|------|
| RAM > 3.5GB sustained | 4GB / 2vCPU | **8GB / 4vCPU** | $48/mo | Month 3-6 |
| CPU > 80% sustained | 4GB / 2vCPU | **8GB / 4vCPU** | $48/mo | Month 3-6 |
| Traffic > 50K/day | Single droplet | **+ Load Balancer** | $72/mo | Month 6-9 |
| MongoDB > 50GB | Local MongoDB | **Managed MongoDB** | +$15/mo | Month 9-12 |
| Need HA (99.9% uptime) | Single droplet | **2 droplets + LB** | $72/mo | Month 9-12 |

### How to Upgrade (Zero Downtime)

```bash
# 1. Take snapshot (backup)
# DigitalOcean Dashboard → Droplet → Snapshots → Take Snapshot

# 2. Resize droplet
# Dashboard → Droplet → Resize → Select 8GB plan → Resize (takes ~1 min)
# Note: "Resize CPU and RAM only" (not disk) allows downgrade later

# 3. Verify
ssh root@vps
free -h          # Should show 8GB
pm2 status       # All services running
curl localhost:3000/health  # Services responding
```

---

## Memory Budget (After Upgrade to 8GB)

```
Total RAM: 8192 MB
├── OS + system:           ~500 MB
├── MongoDB (WiredTiger):  2048 MB (increase cache to 2GB)
├── Redis:                  768 MB (increase to 768MB)
├── Nginx:                  ~50 MB
├── PM2 + 5 Node services: ~1200 MB (240MB each, more headroom)
├── Buffer/swap:           ~600 MB
└── Available:            ~3026 MB (for traffic spikes)
```

After upgrade, update configs:
```bash
# MongoDB: increase cache to 2GB
sudo sed -i 's/cacheSizeGB: 1/cacheSizeGB: 2/' /etc/mongod.conf
sudo systemctl restart mongod

# Redis: increase to 768MB
redis-cli CONFIG SET maxmemory 768mb
redis-cli CONFIG REWRITE
```

---

## Monitoring Thresholds (Update After Upgrade)

| Metric | 4GB VPS | 8GB VPS |
|--------|---------|---------|
| RAM alert | > 3.5GB | > 7GB |
| MongoDB cache | 1GB | 2GB |
| Redis max | 512MB | 768MB |
| PM2 per-service max | 300MB | 500MB |

---

## Cost Projection

| Month | Traffic | VPS Plan | Monthly Cost |
|-------|---------|----------|-------------|
| 1-3 | < 10K/day | 4GB ($24) | $24 |
| 3-6 | 10-50K/day | 4GB ($24) | $24 |
| 6-9 | 50-100K/day | 8GB ($48) | $48 |
| 9-12 | 100K+/day | 8GB + LB ($72) | $72 |

**Rule:** Only upgrade when optimization checklist is exhausted AND alerts persist > 1 hour.
