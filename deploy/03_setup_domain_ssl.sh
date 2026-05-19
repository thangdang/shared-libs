#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Step 3: Domain + SSL Setup
#  Generates SSL certs for all subdomains via Certbot
#  Prerequisite: DNS A records already pointing to this VPS IP
# ═══════════════════════════════════════════════════════════

set -e

# ── Configuration ──
DOMAIN="winlux.com"
EMAIL="admin@winlux.com"

# All subdomains
SUBDOMAINS=(
  "trendbriefai.${DOMAIN}"
  "smartbuy.${DOMAIN}"
  "caremate.${DOMAIN}"
  "fintax.${DOMAIN}"
  "childhood.${DOMAIN}"
  "api.${DOMAIN}"
)

echo "════════════════════════════════════════════════"
echo "  WinLux — Domain + SSL Setup"
echo "════════════════════════════════════════════════"
echo ""
echo "Domain: ${DOMAIN}"
echo "Subdomains: ${SUBDOMAINS[*]}"
echo ""

# ── Verify DNS is pointing to this server ──
echo "[1/3] Verifying DNS records..."
VPS_IP=$(curl -s ifconfig.me)
echo "  VPS IP: ${VPS_IP}"
echo ""

ALL_DNS_OK=true
for sub in "${SUBDOMAINS[@]}"; do
  RESOLVED=$(dig +short "$sub" 2>/dev/null | head -1)
  if [ -z "$RESOLVED" ]; then
    echo "  ❌ ${sub} — DNS not configured"
    ALL_DNS_OK=false
  elif [ "$RESOLVED" != "$VPS_IP" ]; then
    echo "  ⚠️ ${sub} → ${RESOLVED} (expected ${VPS_IP}, may be Cloudflare proxy)"
  else
    echo "  ✅ ${sub} → ${RESOLVED}"
  fi
done

echo ""
if [ "$ALL_DNS_OK" = false ]; then
  echo "⚠️ Some DNS records are not configured."
  echo "   Add these A records in Cloudflare:"
  for sub in "${SUBDOMAINS[@]}"; do
    NAME=$(echo "$sub" | sed "s/.${DOMAIN}//")
    echo "   A  ${NAME}  →  ${VPS_IP}  (Proxied)"
  done
  echo ""
  echo "   If using Cloudflare proxy, DNS will show Cloudflare IP (that's OK)."
  echo "   Proceeding with SSL generation..."
fi

# ── Generate SSL certificates ──
echo "[2/3] Generating SSL certificates with Certbot..."
echo ""

# Build domain list for certbot
DOMAIN_ARGS=""
for sub in "${SUBDOMAINS[@]}"; do
  DOMAIN_ARGS="${DOMAIN_ARGS} -d ${sub}"
done

# Run certbot (nginx plugin auto-configures)
certbot --nginx \
  --non-interactive \
  --agree-tos \
  --email "${EMAIL}" \
  --redirect \
  ${DOMAIN_ARGS} \
  || {
    echo ""
    echo "⚠️ Certbot failed. Common reasons:"
    echo "   - DNS not propagated yet (wait 5 min, retry)"
    echo "   - Cloudflare proxy blocking validation (temporarily disable proxy)"
    echo "   - Rate limit (wait 1 hour)"
    echo ""
    echo "   To retry individual domains:"
    echo "   certbot --nginx -d trendbriefai.${DOMAIN}"
    exit 1
  }

# ── Setup auto-renewal ──
echo ""
echo "[3/3] Setting up auto-renewal..."
systemctl enable --now certbot.timer
echo "  ✅ Certbot auto-renewal enabled (checks twice daily)"

# Verify
echo ""
echo "════════════════════════════════════════════════"
echo "  SSL Setup Complete!"
echo ""
echo "  Certificates:"
for sub in "${SUBDOMAINS[@]}"; do
  if [ -f "/etc/letsencrypt/live/${sub}/fullchain.pem" ]; then
    EXPIRY=$(openssl x509 -enddate -noout -in "/etc/letsencrypt/live/${sub}/fullchain.pem" 2>/dev/null | cut -d= -f2)
    echo "  ✅ ${sub} (expires: ${EXPIRY})"
  else
    echo "  ⚠️ ${sub} — cert not found (may be grouped)"
  fi
done
echo ""
echo "  Auto-renewal: systemctl status certbot.timer"
echo "  Test renewal: certbot renew --dry-run"
echo ""
echo "  Next: bash 04_nginx_config.sh"
echo "════════════════════════════════════════════════"
