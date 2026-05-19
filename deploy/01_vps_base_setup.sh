#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Step 1: VPS Base System Setup
#  Run as root on fresh Ubuntu 22.04 (DigitalOcean SGP1)
#  Installs: Node.js 20, MongoDB 7, Redis, Nginx, PM2, Tailscale
# ═══════════════════════════════════════════════════════════

set -e

echo "════════════════════════════════════════════════"
echo "  WinLux — VPS Base Setup"
echo "  Ubuntu 22.04 / DigitalOcean SGP1"
echo "════════════════════════════════════════════════"
echo ""

# ── Update system ──
echo "[1/7] Updating system..."
apt update && apt upgrade -y
apt install -y curl wget git build-essential software-properties-common

# ── Node.js 20 ──
echo "[2/7] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
echo "Node.js: $(node --version)"
echo "npm: $(npm --version)"

# Install PM2 globally
npm install -g pm2
echo "PM2: $(pm2 --version)"

# ── MongoDB 7 ──
echo "[3/7] Installing MongoDB 7..."
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [ signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update && apt install -y mongodb-org
systemctl enable --now mongod
echo "MongoDB: $(mongosh --version 2>/dev/null || echo 'installed')"

# ── Redis ──
echo "[4/7] Installing Redis..."
apt install -y redis-server
systemctl enable --now redis-server
echo "Redis: $(redis-cli --version)"

# ── Nginx ──
echo "[5/7] Installing Nginx..."
apt install -y nginx
systemctl enable --now nginx
echo "Nginx: $(nginx -v 2>&1)"

# ── Certbot (SSL) ──
echo "[6/7] Installing Certbot..."
apt install -y certbot python3-certbot-nginx

# ── Tailscale VPN ──
echo "[7/7] Installing Tailscale..."
curl -fsSL https://tailscale.com/install.sh | sh
echo ""
echo "════════════════════════════════════════════════"
echo "  Base setup complete!"
echo ""
echo "  Next steps:"
echo "  1. Run: tailscale up"
echo "     (Login with your Tailscale account)"
echo "  2. Note your Tailscale IP: tailscale ip -4"
echo "  3. Run: bash 02_create_databases.sh"
echo "════════════════════════════════════════════════"
