#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# Health Check Monitor — Every 5 minutes
# Checks all services, alerts on 2+ consecutive failures
# Cron: */5 * * * * /opt/shared-libs/deploy/health-check.sh
# ═══════════════════════════════════════════════════════════════

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/telegram-notify.sh"

# State directory for tracking failures
STATE_DIR="/tmp/health-state"
mkdir -p "$STATE_DIR"

# Alert threshold (consecutive failures before alerting)
ALERT_THRESHOLD=2
TIMEOUT=5

# ─── Service definitions ───
# Format: "name|url_or_host:port|type"
# type: http (GET request) or tcp (port check)

SERVICES=(
    # VPS Services
    "trendbriefai-service|http://127.0.0.1:3000/health|http"
    "smartbuy-service|http://127.0.0.1:3001/health|http"
    "caremate-service|http://127.0.0.1:3002/health|http"
    "fin-tax-service|http://127.0.0.1:3003/health|http"
    "childhood-service|http://127.0.0.1:3005/health|http"
    # Infrastructure
    "mongodb|127.0.0.1:27017|tcp"
    "redis|127.0.0.1:6379|tcp"
)

# Local AI engines (via Tailscale — update LOCAL_PC_IP after Tailscale setup)
LOCAL_PC_IP="${LOCAL_PC_TAILSCALE_IP:-100.100.100.100}"

LOCAL_SERVICES=(
    "trendbriefai-engine|http://${LOCAL_PC_IP}:8000/health|http"
    "smartbuy-ai-engine|http://${LOCAL_PC_IP}:8001/health|http"
    "caremate-ai-engine|http://${LOCAL_PC_IP}:8002/health|http"
    "fin-tax-ai-engine|http://${LOCAL_PC_IP}:5000/health|http"
    "childhood-video-engine|http://${LOCAL_PC_IP}:5001/health|http"
    "ollama|http://${LOCAL_PC_IP}:11434/api/tags|http"
)

# ─── Check functions ───

check_http() {
    local url="$1"
    local status_code
    status_code=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$TIMEOUT" "$url" 2>/dev/null)
    [ "$status_code" -ge 200 ] && [ "$status_code" -lt 500 ]
}

check_tcp() {
    local host_port="$1"
    local host="${host_port%%:*}"
    local port="${host_port##*:}"
    timeout "$TIMEOUT" bash -c "echo > /dev/tcp/$host/$port" 2>/dev/null
}

# ─── Main check loop ───

check_service() {
    local name="$1"
    local target="$2"
    local type="$3"
    local state_file="$STATE_DIR/${name}.failures"
    local alert_sent_file="$STATE_DIR/${name}.alerted"

    local is_up=false

    if [ "$type" = "http" ]; then
        check_http "$target" && is_up=true
    elif [ "$type" = "tcp" ]; then
        check_tcp "$target" && is_up=true
    fi

    if [ "$is_up" = true ]; then
        # Service is UP
        if [ -f "$alert_sent_file" ]; then
            # Was down, now recovered
            local downtime_start
            downtime_start=$(cat "$alert_sent_file" 2>/dev/null)
            local now=$(date +%s)
            local downtime_min=$(( (now - downtime_start) / 60 ))
            send_telegram "🟢 <b>RECOVERED:</b> $name
<b>Downtime:</b> ~${downtime_min} minutes
<b>Time:</b> $(date '+%H:%M:%S')"
            rm -f "$alert_sent_file"
        fi
        # Reset failure counter
        echo "0" > "$state_file"
    else
        # Service is DOWN
        local failures=0
        [ -f "$state_file" ] && failures=$(cat "$state_file")
        failures=$((failures + 1))
        echo "$failures" > "$state_file"

        # Alert if threshold reached and not already alerted
        if [ "$failures" -ge "$ALERT_THRESHOLD" ] && [ ! -f "$alert_sent_file" ]; then
            date +%s > "$alert_sent_file"
            send_telegram "🔴 <b>SERVICE DOWN:</b> $name
<b>Target:</b> $target
<b>Failures:</b> $failures consecutive
<b>Time:</b> $(date '+%Y-%m-%d %H:%M:%S')
<b>Action:</b> Check logs or restart service"
        fi
    fi
}

# Check VPS services
for service in "${SERVICES[@]}"; do
    IFS='|' read -r name target type <<< "$service"
    check_service "$name" "$target" "$type"
done

# Check local AI engines (only if Tailscale IP is configured)
if [ "$LOCAL_PC_IP" != "100.100.100.100" ]; then
    for service in "${LOCAL_SERVICES[@]}"; do
        IFS='|' read -r name target type <<< "$service"
        check_service "$name" "$target" "$type"
    done
fi
