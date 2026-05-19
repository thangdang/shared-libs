#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Performance Setup — Run on VPS after deployment
#  Creates indexes, configures Redis, MongoDB, Nginx
#  Safe to run multiple times (createIndex is idempotent)
# ═══════════════════════════════════════════════════════════

set -e
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "════════════════════════════════════════════════"
echo "  WinLux — Performance Setup"
echo "════════════════════════════════════════════════"
echo ""

# ── Step 1: MongoDB Indexes ──
echo "[1/4] Creating MongoDB indexes..."
mongosh smartbuy < "$SCRIPT_DIR/001_indexes_smartbuy.js"
mongosh trendbriefai < "$SCRIPT_DIR/002_indexes_trendbriefai.js"
mongosh caremate_vn < "$SCRIPT_DIR/003_indexes_caremate.js"
mongosh fintax_ai < "$SCRIPT_DIR/004_indexes_fintax.js"
mongosh childhood < "$SCRIPT_DIR/005_indexes_childhood.js"
echo "[OK] All indexes created"
echo ""

# ── Step 2: MongoDB Config ──
echo "[2/4] Configuring MongoDB (WiredTiger cache limit)..."
bash "$SCRIPT_DIR/008_mongodb_config.sh"
echo ""

# ── Step 3: Redis Config ──
echo "[3/4] Configuring Redis (memory limit + eviction)..."
bash "$SCRIPT_DIR/006_redis_config.sh"
echo ""

# ── Step 4: Nginx Config ──
echo "[4/4] Nginx caching config..."
echo "Copy 007_nginx_caching.conf to /etc/nginx/conf.d/performance.conf"
echo "Then run: sudo nginx -t && sudo systemctl reload nginx"
echo ""

echo "════════════════════════════════════════════════"
echo "  Performance setup complete!"
echo ""
echo "  Summary:"
echo "  • MongoDB: 5 databases indexed, cache limited to 1GB"
echo "  • Redis: 512MB max, LRU eviction enabled"
echo "  • Nginx: gzip + caching config ready (manual copy needed)"
echo ""
echo "  Next: Add to MANUAL_SETUP_GUIDE Step 13 (after deploy)"
echo "════════════════════════════════════════════════"
