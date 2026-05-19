#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Step 2: Create MongoDB Databases + Run Seeds
#  Creates 5 product databases + runs seed scripts
# ═══════════════════════════════════════════════════════════

set -e

echo "════════════════════════════════════════════════"
echo "  WinLux — Database Setup"
echo "════════════════════════════════════════════════"
echo ""

# Base path (adjust if repos are cloned elsewhere)
BASE_DIR="/opt"

# ── Create databases (MongoDB auto-creates on first write, but seeds initialize collections) ──

echo "[1/6] Creating TrendBrief AI database..."
if [ -d "$BASE_DIR/trend-brief-ai/database" ]; then
  for f in $BASE_DIR/trend-brief-ai/database/0*.js; do
    echo "  Running: $(basename $f)"
    mongosh trendbriefai < "$f" --quiet
  done
  echo "  ✅ trendbriefai database seeded"
else
  echo "  ⚠️ trend-brief-ai/database not found, creating empty DB"
  mongosh --eval 'use trendbriefai; db.createCollection("articles");' --quiet
fi

echo ""
echo "[2/6] Creating SmartBuy AI database..."
if [ -d "$BASE_DIR/smartbuy-ai/database" ]; then
  for f in $BASE_DIR/smartbuy-ai/database/0*.js; do
    echo "  Running: $(basename $f)"
    mongosh smartbuy < "$f" --quiet
  done
  echo "  ✅ smartbuy database seeded"
else
  echo "  ⚠️ smartbuy-ai/database not found, creating empty DB"
  mongosh --eval 'use smartbuy; db.createCollection("products");' --quiet
fi

echo ""
echo "[3/6] Creating CareMate AI database..."
if [ -d "$BASE_DIR/caremate-ai/database" ]; then
  for f in $BASE_DIR/caremate-ai/database/0*.js; do
    echo "  Running: $(basename $f)"
    mongosh caremate_vn < "$f" --quiet
  done
  echo "  ✅ caremate_vn database seeded"
else
  echo "  ⚠️ caremate-ai/database not found, creating empty DB"
  mongosh --eval 'use caremate_vn; db.createCollection("symptoms");' --quiet
fi

echo ""
echo "[4/6] Creating FIN Tax AI database..."
if [ -d "$BASE_DIR/fin-tax-ai" ]; then
  # FIN Tax uses npm run seed
  echo "  Running seed via service..."
  mongosh --eval 'use fintax_ai; db.createCollection("transactions");' --quiet
  echo "  ✅ fintax_ai database created (run 'npm run seed' after service build)"
else
  mongosh --eval 'use fintax_ai; db.createCollection("transactions");' --quiet
fi

echo ""
echo "[5/6] Creating Childhood Video Engine database..."
if [ -d "$BASE_DIR/ai-video-engine/database" ]; then
  for f in $BASE_DIR/ai-video-engine/database/0*.js; do
    echo "  Running: $(basename $f)"
    mongosh childhood < "$f" --quiet
  done
  echo "  ✅ childhood database seeded"
else
  echo "  ⚠️ ai-video-engine/database not found, creating empty DB"
  mongosh --eval 'use childhood; db.createCollection("videos");' --quiet
fi

echo ""
echo "[6/6] Creating Backoffice database..."
mongosh --eval 'use backoffice; db.createCollection("users");' --quiet
echo "  ✅ backoffice database created"

echo ""
echo "════════════════════════════════════════════════"
echo "  Database setup complete!"
echo ""
echo "  Databases created:"
mongosh --eval 'db.adminCommand("listDatabases").databases.forEach(d => print("  • " + d.name + " (" + (d.sizeOnDisk/1024/1024).toFixed(1) + " MB)"))' --quiet
echo ""
echo "  Next: bash 03_setup_domain_ssl.sh"
echo "════════════════════════════════════════════════"
