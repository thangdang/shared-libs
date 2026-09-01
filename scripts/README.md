# Shared Scripts

Utility scripts for managing WinLux AI applications.

---

## MongoDB Optimization (`mongodb_optimize.py`)

Comprehensive MongoDB optimization toolkit for all 7 WinLux AI apps.

### Features

1. **Collection Size Monitoring** — Alert when collections approach thresholds
2. **TTL Index Management** — Auto-delete old data (logs, sessions, cache)
3. **Data Archival** — Move old data to archive collections
4. **Slow Query Analysis** — Find and fix performance bottlenecks
5. **Index Optimization** — Apply recommended indexes, find unused ones
6. **Report Generation** — JSON reports for tracking over time

### Quick Start

```powershell
cd C:\Users\evtxd01\learn_python\shared-libs\scripts

# Check collection sizes (default action)
python mongodb_optimize.py

# Or use the batch file
.\mongodb_optimize.bat --check
```

### Commands

| Command | Description |
|---------|-------------|
| `--check` | Check collection sizes and show alerts |
| `--apply-indexes` | Apply all defined indexes (dry run) |
| `--apply-ttl` | Apply TTL indexes for auto-cleanup (dry run) |
| `--archive` | Archive old data to `*_archive` collections (dry run) |
| `--analyze` | Analyze slow queries from MongoDB profiler |
| `--unused-indexes` | Find indexes that aren't being used |
| `--full` | Run all optimizations |
| `--report` | Generate JSON report |
| `--execute` | Actually apply changes (without this, it's dry run) |

### Examples

```powershell
# Just check sizes and generate report
python mongodb_optimize.py --check --report

# See what indexes would be created (dry run)
python mongodb_optimize.py --apply-indexes --apply-ttl

# Actually create the indexes
python mongodb_optimize.py --apply-indexes --apply-ttl --execute

# Archive old data (dry run first)
python mongodb_optimize.py --archive
python mongodb_optimize.py --archive --execute  # Actually do it

# Full optimization with report
python mongodb_optimize.py --full --execute -o reports/monthly_report.json
```

### Scheduled Tasks

Set up Windows Task Scheduler for automated maintenance:

| Schedule | Command | Purpose |
|----------|---------|---------|
| Daily 6 AM | `--check --report` | Monitor sizes, catch issues early |
| Weekly Sunday 3 AM | `--archive --execute` | Archive old data |
| Monthly 1st 4 AM | `--full --execute` | Full optimization |

**PowerShell to create tasks:**

```powershell
# Daily check
schtasks /create /tn "MongoDB-Daily-Check" `
  /tr "python C:\Users\evtxd01\learn_python\shared-libs\scripts\mongodb_optimize.py --check --report" `
  /sc daily /st 06:00

# Weekly archive
schtasks /create /tn "MongoDB-Weekly-Archive" `
  /tr "python C:\Users\evtxd01\learn_python\shared-libs\scripts\mongodb_optimize.py --archive --execute" `
  /sc weekly /d SUN /st 03:00

# Monthly full optimization
schtasks /create /tn "MongoDB-Monthly-Full" `
  /tr "python C:\Users\evtxd01\learn_python\shared-libs\scripts\mongodb_optimize.py --full --execute" `
  /sc monthly /d 1 /st 04:00
```

### Configuration

The script includes configurations for all 7 apps:

| Database | Description | Key Collections |
|----------|-------------|-----------------|
| `smartbuy` | Price comparison | products, price_histories, live_streams |
| `caremate_vn` | Health checker | consultations, telemedicine_bookings |
| `trendbriefai` | News aggregation | articles, tiktok_trends |
| `fintax_ai` | Finance & tax | transactions, wallet_imports |
| `doctor_car_ai` | Vehicle diagnostics | diagnoses, voice_transcripts |
| `childhood` | Video engine | video_jobs, shoppertainment_scripts |
| `backoffice` | Admin dashboard | audit_logs, analytics_cache |

### Data Retention Policy

| Data Type | Active Period | Archive After | Delete After |
|-----------|---------------|---------------|--------------|
| Products | Always | 6 months inactive | 2 years |
| Price histories | 90 days | — | Auto-TTL |
| Articles | 1 year | 1 year | 3 years |
| Consultations | 2 years | 2 years | 7 years (legal) |
| Transactions | 5 years | — | 7 years (tax) |
| Job queues | 7 days | — | Auto-TTL |
| Live streams | 3 days | — | Auto-TTL |
| API logs | 30 days | — | Auto-TTL |

### Alert Levels

| Level | Threshold | Action |
|-------|-----------|--------|
| 🟢 OK | < 70% | No action needed |
| 🟡 WARNING | 70-90% | Plan for optimization |
| 🔴 CRITICAL | > 90% | Immediate action required |

### Report Output

Reports are saved as JSON:

```json
{
  "generated_at": "2026-08-31T10:30:00",
  "summary": {
    "total_databases": 7,
    "total_collections": 42,
    "total_documents": 5234567,
    "total_size_gb": 12.45
  },
  "alerts": [...],
  "slow_queries": [...],
  "recommendations": [...]
}
```

### Troubleshooting

**Connection failed:**
```powershell
# Check MongoDB is running
mongosh --eval "db.adminCommand('ping')"

# Set custom URI
python mongodb_optimize.py --uri "mongodb://user:pass@host:27017"
```

**Permission denied:**
```powershell
# Script needs read/write access to databases
# Check MongoDB user permissions
mongosh admin --eval "db.getUsers()"
```

**No profiler data:**
```powershell
# Enable profiling for slow query analysis
mongosh mydb --eval "db.setProfilingLevel(1, {slowms: 100})"
```

---

## Requirements

```
pymongo>=4.0
```

Install:
```powershell
pip install pymongo
```

---

*Last updated: August 2026*
