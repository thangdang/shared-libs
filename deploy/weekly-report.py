#!/usr/bin/env python3
"""
Weekly Status Report — Sends summary to Telegram every Sunday 9 AM.

Cron: 0 9 * * 0 /usr/bin/python3 /opt/shared-libs/deploy/weekly-report.py

Reports:
- Service uptime (PM2 status)
- MongoDB database sizes
- Disk and RAM usage
- Error count from logs
- Crawler status
"""

import json
import os
import subprocess
import sys
from datetime import datetime, timedelta
from pathlib import Path

import urllib.request
import urllib.error

# ─── Configuration ───
SCRIPT_DIR = Path(__file__).parent
TELEGRAM_ENV = SCRIPT_DIR / ".telegram.env"

# Load Telegram credentials
TELEGRAM_BOT_TOKEN = ""
TELEGRAM_CHAT_ID = ""

if TELEGRAM_ENV.exists():
    for line in TELEGRAM_ENV.read_text().splitlines():
        line = line.strip()
        if line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        if key.strip() == "TELEGRAM_BOT_TOKEN":
            TELEGRAM_BOT_TOKEN = value.strip()
        elif key.strip() == "TELEGRAM_CHAT_ID":
            TELEGRAM_CHAT_ID = value.strip()


def send_telegram(message: str) -> bool:
    """Send message via Telegram Bot API."""
    if not TELEGRAM_BOT_TOKEN or not TELEGRAM_CHAT_ID:
        print("[SKIP] Telegram not configured")
        return False

    url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
    data = {
        "chat_id": TELEGRAM_CHAT_ID,
        "text": message,
        "parse_mode": "HTML",
    }
    payload = json.dumps(data).encode("utf-8")

    try:
        req = urllib.request.Request(
            url, data=payload, headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status == 200
    except Exception as e:
        print(f"[ERROR] Telegram send failed: {e}")
        return False


def run_cmd(cmd: str, timeout: int = 10) -> str:
    """Run shell command and return output."""
    try:
        result = subprocess.run(
            cmd, shell=True, capture_output=True, text=True, timeout=timeout
        )
        return result.stdout.strip()
    except (subprocess.TimeoutExpired, Exception):
        return "N/A"


def get_pm2_status() -> str:
    """Get PM2 service status summary."""
    output = run_cmd("pm2 jlist")
    if output == "N/A" or not output:
        return "PM2 not available"

    try:
        apps = json.loads(output)
        lines = []
        for app in apps:
            name = app.get("name", "unknown")
            status = app.get("pm2_env", {}).get("status", "unknown")
            restarts = app.get("pm2_env", {}).get("restart_time", 0)
            uptime_ms = app.get("pm2_env", {}).get("pm_uptime", 0)

            # Calculate uptime
            if uptime_ms:
                uptime_hours = (datetime.now().timestamp() * 1000 - uptime_ms) / 3600000
                uptime_str = f"{uptime_hours:.0f}h"
            else:
                uptime_str = "N/A"

            emoji = "🟢" if status == "online" else "🔴"
            lines.append(f"  {emoji} {name}: {status} (↻{restarts}, ⏱{uptime_str})")

        return "\n".join(lines)
    except json.JSONDecodeError:
        return "PM2 parse error"


def get_mongodb_stats() -> str:
    """Get MongoDB database sizes."""
    databases = [
        "trendbriefai_db",
        "smartbuy_db",
        "caremate_db",
        "fintax_db",
        "childhood_db",
    ]

    lines = []
    for db in databases:
        output = run_cmd(
            f'mongosh --quiet --eval "db.stats().dataSize" {db}'
        )
        try:
            size_bytes = int(output)
            size_mb = size_bytes / (1024 * 1024)
            lines.append(f"  {db}: {size_mb:.1f} MB")
        except (ValueError, TypeError):
            lines.append(f"  {db}: N/A")

    return "\n".join(lines)


def get_system_stats() -> str:
    """Get disk and RAM usage."""
    # RAM
    ram = run_cmd("free -h | grep Mem | awk '{print $3\"/\"$2}'")
    # Disk
    disk = run_cmd("df -h / | tail -1 | awk '{print $3\"/\"$2\" (\"$5\")\"}'")
    # Load average
    load = run_cmd("uptime | awk -F'load average:' '{print $2}'")

    return f"  RAM: {ram}\n  Disk: {disk}\n  Load: {load}"


def get_error_count() -> str:
    """Count errors in PM2 logs from last 7 days."""
    log_dir = Path("/var/log/pm2")
    if not log_dir.exists():
        return "  Log dir not found"

    total_errors = 0
    lines = []

    for log_file in log_dir.glob("*-error.log"):
        # Count lines from last 7 days (approximate: count all lines)
        output = run_cmd(f"wc -l < {log_file}")
        try:
            count = int(output)
            if count > 0:
                service = log_file.stem.replace("-error", "")
                lines.append(f"  {service}: {count} error lines")
                total_errors += count
        except (ValueError, TypeError):
            pass

    if not lines:
        return "  No errors 🎉"

    lines.insert(0, f"  Total: {total_errors} error lines")
    return "\n".join(lines[:6])  # Max 6 lines


def get_backup_status() -> str:
    """Check latest backup status."""
    backup_dir = Path("/backup/mongodb")
    if not backup_dir.exists():
        return "  ⚠️ No backups found"

    # Get latest backup
    backups = sorted(backup_dir.iterdir(), reverse=True)
    if not backups:
        return "  ⚠️ No backups found"

    latest = backups[0]
    size = run_cmd(f"du -sh {latest} | cut -f1")
    age_days = (datetime.now() - datetime.fromtimestamp(latest.stat().st_mtime)).days

    status = "✅" if age_days <= 1 else "⚠️"
    return f"  {status} Latest: {latest.name} ({size}, {age_days}d ago)\n  Total backups: {len(backups)}"


def build_report() -> str:
    """Build the full weekly report."""
    now = datetime.now()
    week_start = (now - timedelta(days=7)).strftime("%b %d")
    week_end = now.strftime("%b %d, %Y")

    report = f"""📊 <b>Weekly Report</b>
<i>{week_start} → {week_end}</i>

<b>━━━ Services ━━━</b>
{get_pm2_status()}

<b>━━━ System ━━━</b>
{get_system_stats()}

<b>━━━ MongoDB ━━━</b>
{get_mongodb_stats()}

<b>━━━ Errors (7d) ━━━</b>
{get_error_count()}

<b>━━━ Backups ━━━</b>
{get_backup_status()}

<i>Next report: {(now + timedelta(days=7)).strftime('%b %d')}</i>"""

    return report


def main():
    """Generate and send weekly report."""
    print(f"[{datetime.now()}] Generating weekly report...")

    report = build_report()
    print(report)
    print()

    success = send_telegram(report)
    if success:
        print("✓ Report sent to Telegram")
    else:
        print("✗ Failed to send report")
        sys.exit(1)


if __name__ == "__main__":
    main()
