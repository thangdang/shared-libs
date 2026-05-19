#!/bin/bash
# MongoDB Performance Configuration
# Run on VPS after MongoDB is installed
# Limits WiredTiger cache to prevent RAM starvation

echo "=== Configuring MongoDB Performance ==="

# Backup current config
sudo cp /etc/mongod.conf /etc/mongod.conf.bak

# Add WiredTiger cache limit (1GB max, default is 50% of RAM = 2GB on 4GB VPS)
# This leaves more RAM for Node.js services + Redis
if ! grep -q "cacheSizeGB" /etc/mongod.conf; then
  sudo sed -i '/^storage:/a\  wiredTiger:\n    engineConfig:\n      cacheSizeGB: 1' /etc/mongod.conf
  echo "Added WiredTiger cacheSizeGB: 1"
else
  echo "WiredTiger cache already configured"
fi

# Enable slow query profiling (log queries > 100ms)
# Useful for finding queries that need indexes
mongosh --eval '
  db.setProfilingLevel(1, { slowms: 100 });
  print("Slow query profiling enabled (>100ms)");
'

# Restart MongoDB to apply config
sudo systemctl restart mongod
sleep 3

# Verify
mongosh --eval '
  var status = db.serverStatus();
  print("WiredTiger cache size: " + (status.wiredTiger.cache["maximum bytes configured"] / 1024 / 1024 / 1024).toFixed(1) + " GB");
  print("Current cache used: " + (status.wiredTiger.cache["bytes currently in the cache"] / 1024 / 1024).toFixed(0) + " MB");
'

echo "=== MongoDB configured ==="
echo "Cache limit: 1GB (was 2GB default)"
echo "Slow query log: enabled (>100ms)"
echo "View slow queries: mongosh --eval 'db.system.profile.find().sort({ts:-1}).limit(5)'"
