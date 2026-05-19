#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Step 5: Firewall (UFW) Configuration
#  Only allows: SSH, HTTP, HTTPS, MongoDB via Tailscale
# ═══════════════════════════════════════════════════════════

set -e

echo "════════════════════════════════════════════════"
echo "  WinLux — Firewall Setup"
echo "════════════════════════════════════════════════"
echo ""

# Reset UFW
ufw --force reset

# Default policies
ufw default deny incoming
ufw default allow outgoing

# Allow SSH (critical — don't lock yourself out!)
ufw allow 22/tcp comment "SSH"

# Allow HTTP + HTTPS (Nginx)
ufw allow 80/tcp comment "HTTP redirect"
ufw allow 443/tcp comment "HTTPS"

# Allow MongoDB from Tailscale network only (100.x.x.x)
ufw allow from 100.0.0.0/8 to any port 27017 comment "MongoDB via Tailscale"

# Allow Redis from Tailscale only
ufw allow from 100.0.0.0/8 to any port 6379 comment "Redis via Tailscale"

# Enable UFW
echo "y" | ufw enable

echo ""
echo "════════════════════════════════════════════════"
echo "  Firewall configured!"
echo ""
ufw status verbose
echo ""
echo "  Rules:"
echo "  ✅ SSH (22) — open to all"
echo "  ✅ HTTP (80) — open to all (redirects to HTTPS)"
echo "  ✅ HTTPS (443) — open to all"
echo "  ✅ MongoDB (27017) — Tailscale only (100.0.0.0/8)"
echo "  ✅ Redis (6379) — Tailscale only (100.0.0.0/8)"
echo "  ❌ All other ports — blocked"
echo ""
echo "  Next: bash 06_build_deploy.sh"
echo "════════════════════════════════════════════════"
