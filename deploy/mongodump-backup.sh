#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# MongoDB Automated Backup — Daily at 3 AM
# Backs up all 5 databases, compresses, retains 7 days
# Cron: 0 3 * * * /opt/shared-libs/deploy/mongodump-backup.sh
# ═══════════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/telegram-notify.sh"

# Configuration
BACKUP_DIR="/backup/mongodb"
RETENTION_DAYS=7
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_PATH="$BACKUP_DIR/$DATE"
LOG_FILE="/var/log/mongodb-backup.log"

# Databases to backup
DATABASES=(
    "trendbriefai_db"
    "smartbuy_db"
    "caremate_db"
    "fintax_db"
    "childhood_db"
)

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Create backup directory
mkdir -p "$BACKUP_PATH"
mkdir -p "$(dirname "$LOG_FILE")"

log "═══ Starting MongoDB backup ═══"
log "Backup path: $BACKUP_PATH"

FAILED_DBS=""
SUCCESS_COUNT=0

for db in "${DATABASES[@]}"; do
    log "Backing up: $db"
    if mongodump --db="$db" --gzip --out="$BACKUP_PATH" 2>> "$LOG_FILE"; then
        SUCCESS_COUNT=$((SUCCESS_COUNT + 1))
        log "✓ $db backup complete"
    else
        FAILED_DBS="$FAILED_DBS $db"
        log "✗ $db backup FAILED"
    fi
done

# Calculate backup size
BACKUP_SIZE=$(du -sh "$BACKUP_PATH" 2>/dev/null | cut -f1)
log "Backup size: $BACKUP_SIZE"

# Delete old backups (older than RETENTION_DAYS)
log "Cleaning backups older than $RETENTION_DAYS days..."
DELETED_COUNT=$(find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +$RETENTION_DAYS | wc -l)
find "$BACKUP_DIR" -maxdepth 1 -type d -mtime +$RETENTION_DAYS -exec rm -rf {} \;
log "Deleted $DELETED_COUNT old backups"

# Report results
if [ -n "$FAILED_DBS" ]; then
    log "⚠️ BACKUP COMPLETED WITH ERRORS"
    send_telegram "🔴 <b>MongoDB Backup Failed</b>
    
<b>Time:</b> $(date '+%Y-%m-%d %H:%M')
<b>Failed DBs:</b>$FAILED_DBS
<b>Success:</b> $SUCCESS_COUNT/${#DATABASES[@]}
<b>Size:</b> $BACKUP_SIZE

Check: <code>tail -50 $LOG_FILE</code>"
    exit 1
else
    log "✅ All $SUCCESS_COUNT databases backed up successfully ($BACKUP_SIZE)"
    # Only send success notification on Sundays (weekly confirmation)
    if [ "$(date +%u)" -eq 7 ]; then
        send_telegram "✅ <b>Weekly Backup OK</b>

<b>Databases:</b> $SUCCESS_COUNT/${#DATABASES[@]}
<b>Size:</b> $BACKUP_SIZE
<b>Retention:</b> $RETENTION_DAYS days
<b>Deleted old:</b> $DELETED_COUNT"
    fi
fi

log "═══ Backup complete ═══"
