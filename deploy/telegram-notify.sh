#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Telegram Notification Helper
# Usage: source telegram-notify.sh && send_telegram "Your message"
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TELEGRAM_ENV="$SCRIPT_DIR/.telegram.env"

# Load Telegram credentials
if [ -f "$TELEGRAM_ENV" ]; then
    source "$TELEGRAM_ENV"
fi

# Validate credentials
if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
    echo "[WARN] Telegram not configured. Copy .telegram.env.example to .telegram.env"
fi

send_telegram() {
    local message="$1"
    local parse_mode="${2:-HTML}"

    if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
        echo "[SKIP] Telegram not configured, message: $message"
        return 1
    fi

    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "text=${message}" \
        -d "parse_mode=${parse_mode}" \
        > /dev/null 2>&1

    return $?
}
