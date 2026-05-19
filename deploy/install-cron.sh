#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Install All Cron Jobs — Run once on VPS
# Usage: bash install-cron.sh
# ═══════════════════════════════════════════════════════════════

set -e

DEPLOY_DIR="/opt/shared-libs/deploy"

echo "═══ Installing OPC Cron Jobs ═══"
echo ""

# Make scripts executable
chmod +x "$DEPLOY_DIR/mongodump-backup.sh"
chmod +x "$DEPLOY_DIR/health-check.sh"
chmod +x "$DEPLOY_DIR/telegram-notify.sh"
chmod +x "$DEPLOY_DIR/09_memory_optimization.sh"
chmod +x "$DEPLOY_DIR/weekly-report.py"

# Create log directories
mkdir -p /var/log/pm2
mkdir -p /backup/mongodb
mkdir -p /tmp/health-state

# ─── Install cron jobs ───
# Remove existing WinLux cron entries (idempotent)
crontab -l 2>/dev/null | grep -v "shared-libs/deploy" | crontab - 2>/dev/null || true

# Add new cron entries
(crontab -l 2>/dev/null; cat <<EOF

# ═══ WinLux OPC — Automated Operations ═══
# MongoDB backup — daily at 3:00 AM
0 3 * * * $DEPLOY_DIR/mongodump-backup.sh >> /var/log/mongodb-backup.log 2>&1

# Health check — every 5 minutes
*/5 * * * * $DEPLOY_DIR/health-check.sh >> /var/log/health-check.log 2>&1

# Weekly report — Sunday at 9:00 AM (UTC+7 = 2:00 AM UTC)
0 2 * * 0 /usr/bin/python3 $DEPLOY_DIR/weekly-report.py >> /var/log/weekly-report.log 2>&1

# Log rotation for health-check.log (keep under 10MB)
0 0 * * * find /var/log -name "health-check.log" -size +10M -exec truncate -s 0 {} \;

EOF
) | crontab -

echo "✓ Cron jobs installed:"
echo ""
crontab -l | grep -A1 "WinLux"
echo ""

# ─── Verify ───
echo "═══ Verification ═══"
echo ""
echo "Cron jobs:"
crontab -l | grep "shared-libs"
echo ""
echo "Scripts executable:"
ls -la "$DEPLOY_DIR/mongodump-backup.sh" "$DEPLOY_DIR/health-check.sh" "$DEPLOY_DIR/weekly-report.py"
echo ""
echo "Directories:"
ls -d /backup/mongodb /var/log/pm2 /tmp/health-state
echo ""

# ─── Test Telegram ───
echo "Testing Telegram notification..."
source "$DEPLOY_DIR/telegram-notify.sh"
send_telegram "🔧 <b>OPC Cron Jobs Installed</b>

<b>Jobs:</b>
• MongoDB backup: daily 3 AM
• Health check: every 5 min
• Weekly report: Sunday 9 AM

<b>Server:</b> $(hostname)
<b>Time:</b> $(date '+%Y-%m-%d %H:%M:%S')"

if [ $? -eq 0 ]; then
    echo "✓ Telegram notification sent"
else
    echo "⚠ Telegram not configured (copy .telegram.env.example → .telegram.env)"
fi

echo ""
echo "═══ Installation Complete ═══"
echo ""
echo "Next steps:"
echo "  1. Copy .telegram.env.example → .telegram.env and fill in credentials"
echo "  2. Set LOCAL_PC_TAILSCALE_IP in health-check.sh (after Tailscale setup)"
echo "  3. Run: bash 09_memory_optimization.sh (memory optimization)"
echo "  4. Deploy PM2: pm2 start ecosystem.config.js"
echo "  5. Save PM2: pm2 save && pm2 startup"
