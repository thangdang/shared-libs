#!/bin/bash
# ═══════════════════════════════════════════════════════════════
#  WinLux AI — VPS Initial Setup (Run ONCE on new VPS)
#  Ubuntu 22.04 LTS, 8 GB RAM minimum
# ═══════════════════════════════════════════════════════════════

set -e
echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  WinLux AI — VPS Setup                  ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ─── System Update ─────────────────────────────────────────
echo "[1/8] Updating system..."
apt update && apt upgrade -y
echo "      ✓ System updated"

# ─── Node.js 20 ───────────────────────────────────────────
echo "[2/8] Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pm2
echo "      ✓ Node.js $(node -v) + PM2 installed"

# ─── MongoDB 7 ────────────────────────────────────────────
echo "[3/8] Installing MongoDB 7..."
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-7.0.gpg
echo "deb [signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg] http://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update && apt install -y mongodb-org
systemctl start mongod && systemctl enable mongod
echo "      ✓ MongoDB 7 installed"

# ─── Redis 7 ──────────────────────────────────────────────
echo "[4/8] Installing Redis..."
apt install -y redis-server
systemctl enable redis-server
echo "      ✓ Redis installed"

# ─── Nginx ────────────────────────────────────────────────
echo "[5/8] Installing Nginx..."
apt install -y nginx certbot python3-certbot-nginx
echo "      ✓ Nginx + Certbot installed"

# ─── Tailscale ────────────────────────────────────────────
echo "[6/8] Installing Tailscale..."
curl -fsSL https://tailscale.com/install.sh | sh
echo "      ✓ Tailscale installed (run 'tailscale up' to connect)"

# ─── Create Directories ───────────────────────────────────
echo "[7/8] Creating directories..."
mkdir -p /opt/winlux/{packages,services,webs,logs,backups}
mkdir -p /opt/winlux/services/{auth,payment,smartbuy,trendbriefai,caremate,fintax,doctorcar,childhood,backoffice}
mkdir -p /opt/winlux/services/{smartbuy-zalo,trendbriefai-zalo,caremate-zalo,fintax-zalo,doctorcar-zalo,childhood-zalo}
mkdir -p /opt/winlux/webs/{smartbuy,trendbriefai,caremate,fintax,doctorcar,childhood,backoffice}
echo "      ✓ Directories created"

# ─── Firewall ─────────────────────────────────────────────
echo "[8/8] Configuring firewall..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable
echo "      ✓ Firewall configured (22, 80, 443 open)"

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  ✓ VPS SETUP COMPLETE                   ║"
echo "╚══════════════════════════════════════════╝"
echo ""
echo "Next steps:"
echo "  1. Run: tailscale up"
echo "  2. Copy .env files to /opt/winlux/services/*/"
echo "  3. Run: deploy-extract.sh (after uploading packages)"
echo "  4. Run: setup-nginx.sh"
echo "  5. Run: seed-databases.sh"
