#!/bin/bash
# Redis Performance Configuration
# Run on VPS after Redis is installed
# Prevents memory overflow as cache grows

echo "=== Configuring Redis Performance ==="

# Set max memory to 512MB (VPS has 4GB total, MongoDB needs ~1.5GB)
redis-cli CONFIG SET maxmemory 512mb

# LRU eviction — remove least recently used keys when full
redis-cli CONFIG SET maxmemory-policy allkeys-lru

# Disable RDB persistence (we use Redis as cache only, not primary storage)
# Data is reconstructable from MongoDB
redis-cli CONFIG SET save ""

# Enable lazy freeing (non-blocking key deletion)
redis-cli CONFIG SET lazyfree-lazy-eviction yes
redis-cli CONFIG SET lazyfree-lazy-expire yes

# Connection limits
redis-cli CONFIG SET maxclients 256

# Persist config
redis-cli CONFIG REWRITE

echo "=== Redis configured ==="
echo "Max memory: 512MB"
echo "Eviction: allkeys-lru"
echo "Persistence: disabled (cache-only mode)"
redis-cli INFO memory | grep used_memory_human
