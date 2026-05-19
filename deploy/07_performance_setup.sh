#!/bin/bash
# ═══════════════════════════════════════════════════════════
#  Step 7: Performance Setup
#  Runs indexes + Redis + MongoDB config from performance/
# ═══════════════════════════════════════════════════════════

set -e

echo "════════════════════════════════════════════════"
echo "  WinLux — Performance Setup"
echo "════════════════════════════════════════════════"
echo ""

PERF_DIR="/opt/shared-libs/performance"

if [ ! -d "$PERF_DIR" ]; then
  echo "❌ Performance scripts not found at $PERF_DIR"
  echo "   Make sure shared-libs is cloned to /opt/shared-libs"
  exit 1
fi

# Run the master performance setup script
bash "$PERF_DIR/setup-performance.sh"

echo ""
echo "════════════════════════════════════════════════"
echo "  Performance setup complete!"
echo ""
echo "  Next: bash 08_verify_health.sh"
echo "════════════════════════════════════════════════"
