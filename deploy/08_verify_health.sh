#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Step 8: Verify All Services Are Healthy
#  Checks: PM2 status, health endpoints, web apps, MongoDB, Redis
# ═══════════════════════════════════════════════════════════

echo "════════════════════════════════════════════════"
echo "  WinLux — Health Verification"
echo "════════════════════════════════════════════════"
echo ""

PASS=0
FAIL=0

check() {
  local name=$1
  local url=$2
  local expected=$3

  RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "$url" 2>/dev/null)
  if [ "$RESPONSE" = "$expected" ]; then
    echo "  ✅ $name — HTTP $RESPONSE"
    PASS=$((PASS + 1))
  else
    echo "  ❌ $name — HTTP $RESPONSE (expected $expected)"
    FAIL=$((FAIL + 1))
  fi
}

# ── PM2 Services ──
echo "── PM2 Services ──"
pm2 status
echo ""

# ── Backend Health Endpoints ──
echo "── Backend Health Checks ──"
check "trendbriefai-service" "http://localhost:3000/health" "200"
check "smartbuy-service" "http://localhost:3001/health" "200"
check "caremate-service" "http://localhost:3002/health" "200"
check "fin-tax-service" "http://localhost:3003/health" "200"
check "childhood-service" "http://localhost:3005/health" "200"
check "payment-service" "http://localhost:3006/health" "200"
check "auth-service" "http://localhost:3007/health" "200"
echo ""

# ── Web Apps (via Nginx HTTPS) ──
echo "── Web Apps (HTTPS) ──"
check "trendbriefai.winlux.com" "https://trendbriefai.winlux.com" "200"
check "smartbuy.winlux.com" "https://smartbuy.winlux.com" "200"
check "caremate.winlux.com" "https://caremate.winlux.com" "200"
check "fintax.winlux.com" "https://fintax.winlux.com" "200"
check "childhood.winlux.com" "https://childhood.winlux.com" "200"
echo ""

# ── API Gateway ──
echo "── API Gateway ──"
check "api/trendbriefai/health" "https://api.winlux.com/trendbriefai/health" "200"
check "api/smartbuy/health" "https://api.winlux.com/smartbuy/health" "200"
check "api/caremate/health" "https://api.winlux.com/caremate/health" "200"
check "api/fintax/health" "https://api.winlux.com/fintax/health" "200"
check "api/video/health" "https://api.winlux.com/video/health" "200"
echo ""

# ── Infrastructure ──
echo "── Infrastructure ──"
MONGO_OK=$(mongosh --eval 'db.runCommand({ping:1}).ok' --quiet 2>/dev/null)
if [ "$MONGO_OK" = "1" ]; then
  echo "  ✅ MongoDB — connected"
  PASS=$((PASS + 1))
else
  echo "  ❌ MongoDB — not responding"
  FAIL=$((FAIL + 1))
fi

REDIS_OK=$(redis-cli ping 2>/dev/null)
if [ "$REDIS_OK" = "PONG" ]; then
  echo "  ✅ Redis — connected"
  PASS=$((PASS + 1))
else
  echo "  ❌ Redis — not responding"
  FAIL=$((FAIL + 1))
fi

TAILSCALE_IP=$(tailscale ip -4 2>/dev/null)
if [ -n "$TAILSCALE_IP" ]; then
  echo "  ✅ Tailscale — connected (IP: $TAILSCALE_IP)"
  PASS=$((PASS + 1))
else
  echo "  ⚠️ Tailscale — not connected (run: tailscale up)"
fi

echo ""
echo "════════════════════════════════════════════════"
echo "  Verification Results"
echo ""
echo "  ✅ Passed: $PASS"
echo "  ❌ Failed: $FAIL"
echo ""
if [ $FAIL -eq 0 ]; then
  echo "  🎉 ALL SYSTEMS GO! Ready for traffic."
else
  echo "  ⚠️ Some checks failed. Review errors above."
  echo "  Common fixes:"
  echo "    - Service down: pm2 restart <name>"
  echo "    - Web 404: Check dist/ folder exists (rebuild?)"
  echo "    - API 502: Check .env file has correct ports"
fi
echo "════════════════════════════════════════════════"
