#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Step 6: Build + Deploy All Services & Web Apps
#  Clones repos, installs deps, builds, starts PM2
# ═══════════════════════════════════════════════════════════

set -e

BASE_DIR="/opt"
# Replace with your actual git URLs
GIT_BASE="git@bitbucket.org:your-workspace"

echo "════════════════════════════════════════════════"
echo "  WinLux — Build & Deploy"
echo "════════════════════════════════════════════════"
echo ""

# ── Clone repos (skip if already exists) ──
echo "[1/4] Cloning repositories..."

clone_if_missing() {
  local dir=$1
  local repo=$2
  if [ ! -d "$BASE_DIR/$dir" ]; then
    echo "  Cloning $dir..."
    git clone "$repo" "$BASE_DIR/$dir"
  else
    echo "  ✅ $dir already exists, pulling latest..."
    cd "$BASE_DIR/$dir" && git pull origin main && cd -
  fi
}

clone_if_missing "trend-brief-ai" "${GIT_BASE}/trend-brief-ai.git"
clone_if_missing "smartbuy-ai" "${GIT_BASE}/smartbuy-ai.git"
clone_if_missing "caremate-ai" "${GIT_BASE}/caremate-ai.git"
clone_if_missing "fin-tax-ai" "${GIT_BASE}/fin-tax-ai.git"
clone_if_missing "ai-video-engine" "${GIT_BASE}/ai-video-engine.git"
clone_if_missing "shared-libs" "${GIT_BASE}/shared-libs.git"
clone_if_missing "backoffice-ai" "${GIT_BASE}/backoffice-ai.git"

# ── Build services (Express.js + TypeScript) ──
echo ""
echo "[2/4] Building backend services..."

build_service() {
  local dir=$1
  local name=$2
  echo "  Building $name..."
  cd "$BASE_DIR/$dir"
  npm ci --production=false
  npm run build
  echo "  ✅ $name built"
}

build_service "trend-brief-ai/trendbriefai-service" "trendbriefai-service"
build_service "smartbuy-ai/smartbuy-service" "smartbuy-service"
build_service "caremate-ai/caremate-service" "caremate-service"
build_service "fin-tax-ai/fin-tax-service" "fin-tax-service"
build_service "ai-video-engine/childhood-service" "childhood-service"
build_service "shared-libs/auth-service" "auth-service"
build_service "shared-libs/payment-service" "payment-service"

# ── Build web apps (Angular) ──
echo ""
echo "[3/4] Building web apps..."

build_web() {
  local dir=$1
  local name=$2
  echo "  Building $name..."
  cd "$BASE_DIR/$dir"
  npm ci
  npm run build
  echo "  ✅ $name built"
}

build_web "trend-brief-ai/trendbriefai-web" "trendbriefai-web"
build_web "smartbuy-ai/smartbuy-web" "smartbuy-web"
build_web "caremate-ai/caremate-ui" "caremate-ui"
build_web "fin-tax-ai/fin-tax-ui" "fin-tax-ui"
build_web "ai-video-engine/childhood-ui" "childhood-ui"

# ── Start PM2 ecosystem ──
echo ""
echo "[4/4] Starting PM2 services..."

# Create ecosystem file
cat > ${BASE_DIR}/ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'trendbriefai-service',
      cwd: '/opt/trend-brief-ai/trendbriefai-service',
      script: 'dist/index.js',
      env: { PORT: 3000, NODE_ENV: 'production' },
      max_memory_restart: '512M',
    },
    {
      name: 'smartbuy-service',
      cwd: '/opt/smartbuy-ai/smartbuy-service',
      script: 'dist/index.js',
      env: { PORT: 3001, NODE_ENV: 'production' },
      max_memory_restart: '512M',
    },
    {
      name: 'caremate-service',
      cwd: '/opt/caremate-ai/caremate-service',
      script: 'dist/index.js',
      env: { PORT: 3002, NODE_ENV: 'production' },
      max_memory_restart: '512M',
    },
    {
      name: 'fin-tax-service',
      cwd: '/opt/fin-tax-ai/fin-tax-service',
      script: 'dist/index.js',
      env: { PORT: 3003, NODE_ENV: 'production' },
      max_memory_restart: '512M',
    },
    {
      name: 'childhood-service',
      cwd: '/opt/ai-video-engine/childhood-service',
      script: 'dist/index.js',
      env: { PORT: 3005, NODE_ENV: 'production' },
      max_memory_restart: '512M',
    },
    {
      name: 'auth-service',
      cwd: '/opt/shared-libs/auth-service',
      script: 'dist/index.js',
      env: { PORT: 3007, NODE_ENV: 'production' },
      max_memory_restart: '256M',
    },
    {
      name: 'payment-service',
      cwd: '/opt/shared-libs/payment-service',
      script: 'dist/index.js',
      env: { PORT: 3006, NODE_ENV: 'production' },
      max_memory_restart: '256M',
    },
  ],
};
EOF

pm2 start ${BASE_DIR}/ecosystem.config.js
pm2 save
pm2 startup systemd -u root --hp /root

echo ""
echo "════════════════════════════════════════════════"
echo "  Build & Deploy complete!"
echo ""
pm2 status
echo ""
echo "  Next: bash 07_performance_setup.sh"
echo "════════════════════════════════════════════════"
