#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  WinLux — Full VPS Deployment (Master Script)
#  
#  Run this on a fresh Ubuntu 22.04 VPS (DigitalOcean SGP1)
#  Total time: ~15-20 minutes
#
#  Prerequisites:
#  - Fresh Ubuntu 22.04 VPS with SSH access
#  - DNS A records pointing to VPS IP (Cloudflare)
#  - Git repos accessible (SSH key or HTTPS token)
#
#  Usage:
#    ssh root@your-vps
#    git clone <shared-libs-repo> /opt/shared-libs
#    cd /opt/shared-libs/deploy
#    bash deploy-all.sh
# ═══════════════════════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  WinLux — Full VPS Deployment            ║"
echo "║  6 Web Apps + 7 Services + MongoDB + Redis      ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
echo "This script will:"
echo "  1. Install Node.js, MongoDB, Redis, Nginx, PM2, Tailscale"
echo "  2. Create 6 MongoDB databases + run seeds"
echo "  3. Generate SSL certificates for all domains"
echo "  4. Configure Nginx (reverse proxy + static files)"
echo "  5. Setup firewall (UFW)"
echo "  6. Build + deploy all services and web apps"
echo "  7. Apply performance optimizations"
echo "  8. Verify all health endpoints"
echo ""
echo "Estimated time: 15-20 minutes"
echo ""
read -p "Continue? (y/n) " -n 1 -r
echo ""
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
  echo "Aborted."
  exit 0
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Step 1/8: Base System Setup"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/01_vps_base_setup.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Step 2/8: Create Databases"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/02_create_databases.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Step 3/8: Domain + SSL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/03_setup_domain_ssl.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Step 4/8: Nginx Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/04_nginx_config.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Step 5/8: Firewall"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/05_firewall.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Step 6/8: Build + Deploy Services"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/06_build_deploy.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Step 7/8: Performance Optimization"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/07_performance_setup.sh"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Step 8/8: Health Verification"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
bash "$SCRIPT_DIR/08_verify_health.sh"

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  🎉 DEPLOYMENT COMPLETE!                        ║"
echo "║                                                  ║"
echo "║  Your sites are live:                            ║"
echo "║  • https://trendbriefai.winlux.com            ║"
echo "║  • https://smartbuy.winlux.com                ║"
echo "║  • https://caremate.winlux.com                ║"
echo "║  • https://fintax.winlux.com                  ║"
echo "║  • https://childhood.winlux.com               ║"
echo "║  • https://api.winlux.com                     ║"
echo "║                                                  ║"
echo "║  Next steps:                                     ║"
echo "║  1. Connect Tailscale: tailscale up              ║"
echo "║  2. Start AI engines on local PC                 ║"
echo "║  3. Create .env files with production secrets    ║"
echo "║  4. Follow MANUAL_SETUP_GUIDE.md for accounts   ║"
echo "╚══════════════════════════════════════════════════╝"
