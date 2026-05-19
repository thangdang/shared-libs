#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# VPS Memory Optimization
# Configures swap, MongoDB cache limit, Redis memory limit
# Run once after VPS setup: bash 09_memory_optimization.sh
# ═══════════════════════════════════════════════════════════════

set -e

echo "═══ VPS Memory Optimization ═══"
echo ""

# ─── 1. Create 2GB Swap File ───
echo "▶ Step 1: Swap file (2GB)"

if [ -f /swapfile ]; then
    echo "  ✓ Swap file already exists"
    swapon --show
else
    echo "  Creating 2GB swap file..."
    fallocate -l 2G /swapfile
    chmod 600 /swapfile
    mkswap /swapfile
    swapon /swapfile

    # Make permanent
    if ! grep -q "/swapfile" /etc/fstab; then
        echo "/swapfile none swap sw 0 0" >> /etc/fstab
    fi

    # Optimize swappiness (prefer RAM, use swap only when needed)
    sysctl vm.swappiness=10
    if ! grep -q "vm.swappiness" /etc/sysctl.conf; then
        echo "vm.swappiness=10" >> /etc/sysctl.conf
    fi

    echo "  ✓ Swap file created and activated"
fi

echo ""

# ─── 2. MongoDB WiredTiger Cache Limit ───
echo "▶ Step 2: MongoDB WiredTiger cache (1GB limit)"

MONGOD_CONF="/etc/mongod.conf"

if [ -f "$MONGOD_CONF" ]; then
    if grep -q "cacheSizeGB" "$MONGOD_CONF"; then
        echo "  ✓ WiredTiger cache already configured"
    else
        # Add WiredTiger config
        # Check if storage section exists
        if grep -q "^storage:" "$MONGOD_CONF"; then
            # Add wiredTiger config under storage section
            sed -i '/^storage:/a\  wiredTiger:\n    engineConfig:\n      cacheSizeGB: 1' "$MONGOD_CONF"
        else
            echo "" >> "$MONGOD_CONF"
            echo "storage:" >> "$MONGOD_CONF"
            echo "  wiredTiger:" >> "$MONGOD_CONF"
            echo "    engineConfig:" >> "$MONGOD_CONF"
            echo "      cacheSizeGB: 1" >> "$MONGOD_CONF"
        fi
        echo "  ✓ WiredTiger cache set to 1GB"
        echo "  ⚠ Restart MongoDB: sudo systemctl restart mongod"
    fi
else
    echo "  ⚠ MongoDB config not found at $MONGOD_CONF"
    echo "  Manual: add 'storage.wiredTiger.engineConfig.cacheSizeGB: 1' to mongod.conf"
fi

echo ""

# ─── 3. Redis Memory Limit ───
echo "▶ Step 3: Redis memory limit (512MB + LRU eviction)"

if command -v redis-cli &> /dev/null; then
    redis-cli CONFIG SET maxmemory 512mb > /dev/null 2>&1
    redis-cli CONFIG SET maxmemory-policy allkeys-lru > /dev/null 2>&1

    # Make persistent
    redis-cli CONFIG REWRITE > /dev/null 2>&1 || true

    echo "  ✓ Redis maxmemory: 512MB"
    echo "  ✓ Redis eviction: allkeys-lru"

    # Verify
    CURRENT_MEM=$(redis-cli CONFIG GET maxmemory | tail -1)
    echo "  Current setting: $CURRENT_MEM bytes"
else
    echo "  ⚠ redis-cli not found. Install Redis first."
fi

echo ""

# ─── 4. System Limits ───
echo "▶ Step 4: System file descriptor limits"

LIMITS_CONF="/etc/security/limits.conf"
if ! grep -q "nofile" "$LIMITS_CONF" 2>/dev/null; then
    echo "* soft nofile 65535" >> "$LIMITS_CONF"
    echo "* hard nofile 65535" >> "$LIMITS_CONF"
    echo "  ✓ File descriptor limits increased to 65535"
else
    echo "  ✓ File descriptor limits already configured"
fi

echo ""

# ─── Summary ───
echo "═══ Memory Optimization Complete ═══"
echo ""
echo "Current memory status:"
free -h
echo ""
echo "Swap status:"
swapon --show
echo ""
echo "Next steps:"
echo "  1. Restart MongoDB: sudo systemctl restart mongod"
echo "  2. Verify Redis: redis-cli INFO memory | grep used_memory_human"
echo "  3. Monitor: watch -n 5 free -h"
