/**
 * Data Archival Script — Tasks 27-28
 * 
 * Moves old price_histories to archive collection (>90 days)
 * Verifies TTL indexes are working (sessions, AI logs auto-deleted)
 * 
 * Run: mongosh smartbuy < 010_data_archival.js
 * Schedule: Weekly (Sunday 3AM) via cron
 * 
 * Cron setup:
 *   0 3 * * 0 mongosh smartbuy < /opt/shared-libs/performance/010_data_archival.js >> /var/log/archival.log 2>&1
 */

print("═══════════════════════════════════════════════");
print("  Data Archival — " + new Date().toISOString());
print("═══════════════════════════════════════════════");

// ── Config ──
const ARCHIVE_DAYS = 90;
const cutoffDate = new Date();
cutoffDate.setDate(cutoffDate.getDate() - ARCHIVE_DAYS);

print("Archiving data older than: " + cutoffDate.toISOString());
print("");

// ═══════════════════════════════════════════════
// 1. Archive price_histories (SmartBuy)
// ═══════════════════════════════════════════════

print("── SmartBuy: price_histories archival ──");

const priceHistoryCount = db.price_histories.countDocuments({
  recorded_at: { $lt: cutoffDate }
});

print("Records to archive: " + priceHistoryCount);

if (priceHistoryCount > 0) {
  // Create archive collection if not exists (with same indexes)
  if (!db.getCollectionNames().includes("price_histories_archive")) {
    db.createCollection("price_histories_archive");
    db.price_histories_archive.createIndex({ product_id: 1, recorded_at: -1 });
    db.price_histories_archive.createIndex({ recorded_at: -1 });
    print("Created price_histories_archive collection with indexes");
  }

  // Move old records to archive (batch of 10000)
  const BATCH_SIZE = 10000;
  let archived = 0;

  while (true) {
    const batch = db.price_histories.find(
      { recorded_at: { $lt: cutoffDate } }
    ).limit(BATCH_SIZE).toArray();

    if (batch.length === 0) break;

    // Insert into archive
    db.price_histories_archive.insertMany(batch, { ordered: false });

    // Delete from hot collection
    const ids = batch.map(doc => doc._id);
    db.price_histories.deleteMany({ _id: { $in: ids } });

    archived += batch.length;
    print("  Archived batch: " + batch.length + " (total: " + archived + ")");
  }

  print("✅ Archived " + archived + " price_history records");
} else {
  print("✅ No records to archive");
}

print("");

// ═══════════════════════════════════════════════
// 2. Verify TTL indexes are working
// ═══════════════════════════════════════════════

print("── TTL Index Verification ──");

// Check sessions (should auto-delete after 7 days)
const sevenDaysAgo = new Date();
sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

const expiredSessions = db.sessions.countDocuments({
  created_at: { $lt: sevenDaysAgo }
});

if (expiredSessions === 0) {
  print("✅ Sessions TTL working (no expired sessions found)");
} else {
  print("⚠️ Found " + expiredSessions + " expired sessions — TTL index may not be active");
  print("   Fix: db.sessions.createIndex({ created_at: 1 }, { expireAfterSeconds: 604800 })");
}

// Check AI output logs (should auto-delete after 90 days)
const ninetyDaysAgo = new Date();
ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

// Only check if collection exists
if (db.getCollectionNames().includes("ai_output_logs")) {
  const expiredLogs = db.ai_output_logs.countDocuments({
    created_at: { $lt: ninetyDaysAgo }
  });

  if (expiredLogs === 0) {
    print("✅ AI logs TTL working (no expired logs found)");
  } else {
    print("⚠️ Found " + expiredLogs + " expired AI logs — TTL index may not be active");
  }
} else {
  print("ℹ️ ai_output_logs collection not found (OK if not using AI logging yet)");
}

// Check OTP codes (should auto-delete after 5 min)
if (db.getCollectionNames().includes("otp_codes")) {
  const fiveMinAgo = new Date();
  fiveMinAgo.setMinutes(fiveMinAgo.getMinutes() - 5);

  const expiredOTPs = db.otp_codes.countDocuments({
    created_at: { $lt: fiveMinAgo }
  });

  if (expiredOTPs === 0) {
    print("✅ OTP TTL working");
  } else {
    print("⚠️ Found " + expiredOTPs + " expired OTPs");
  }
}

print("");

// ═══════════════════════════════════════════════
// 3. Collection size report
// ═══════════════════════════════════════════════

print("── Collection Size Report ──");

const collections = ["products", "price_histories", "price_histories_archive", "offers", "users", "sessions"];
collections.forEach(name => {
  if (db.getCollectionNames().includes(name)) {
    const count = db[name].estimatedDocumentCount();
    const stats = db[name].stats();
    const sizeMB = (stats.size / 1024 / 1024).toFixed(1);
    print("  " + name.padEnd(30) + count.toString().padStart(10) + " docs  " + sizeMB.padStart(8) + " MB");
  }
});

print("");
print("═══════════════════════════════════════════════");
print("  Archival complete: " + new Date().toISOString());
print("═══════════════════════════════════════════════");
