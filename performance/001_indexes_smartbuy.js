/**
 * SmartBuy AI — MongoDB Compound Indexes
 * Run: mongosh smartbuy < 001_indexes_smartbuy.js
 * 
 * Critical for performance when products > 10K, price_histories > 100K
 */

print("=== SmartBuy AI — Creating Performance Indexes ===");

// Products — search + filtering
db.products.createIndex({ category: 1, "offers.price": 1, updated_at: -1 }, { name: "idx_category_price_updated" });
db.products.createIndex({ brand: 1, category: 1, "offers.price": 1 }, { name: "idx_brand_category_price" });
db.products.createIndex({ slug: 1 }, { unique: true, name: "idx_slug_unique" });
db.products.createIndex({ name: "text", brand: "text" }, { name: "idx_text_search", default_language: "none" });
db.products.createIndex({ is_active: 1, updated_at: -1 }, { name: "idx_active_updated" });
db.products.createIndex({ "crawl_source": 1, "source_id": 1 }, { name: "idx_source_dedup" });

// Price histories — most queried, grows fastest
db.price_histories.createIndex({ product_id: 1, recorded_at: -1 }, { name: "idx_product_date" });
db.price_histories.createIndex({ product_id: 1, platform: 1, recorded_at: -1 }, { name: "idx_product_platform_date" });

// Offers — current prices per platform
db.offers.createIndex({ product_id: 1, platform: 1, is_active: 1 }, { name: "idx_product_platform_active" });
db.offers.createIndex({ is_active: 1, "price.current": 1, updated_at: -1 }, { name: "idx_active_price" });
db.offers.createIndex({ product_id: 1, is_active: 1, "price.current": 1 }, { name: "idx_product_active_price" });

// Price alerts — user notifications
db.price_alerts.createIndex({ user_id: 1, is_active: 1 }, { name: "idx_user_active_alerts" });
db.price_alerts.createIndex({ product_id: 1, target_price: 1, is_active: 1 }, { name: "idx_product_target" });

// Users
db.users.createIndex({ email: 1 }, { unique: true, sparse: true, name: "idx_email_unique" });
db.users.createIndex({ "google_id": 1 }, { sparse: true, name: "idx_google_id" });

// Crawl sources — scheduler
db.crawl_sources.createIndex({ is_active: 1, priority: -1, next_crawl_at: 1 }, { name: "idx_scheduler" });

// Sessions — TTL auto-cleanup
db.sessions.createIndex({ created_at: 1 }, { expireAfterSeconds: 604800, name: "idx_session_ttl_7d" });

// BullMQ jobs cleanup (if stored in MongoDB)
db.bull_jobs.createIndex({ finished_on: 1 }, { expireAfterSeconds: 86400, name: "idx_jobs_ttl_24h", sparse: true });

print("=== SmartBuy indexes created ===");
print("Total indexes on products: " + db.products.getIndexes().length);
print("Total indexes on price_histories: " + db.price_histories.getIndexes().length);
print("Total indexes on offers: " + db.offers.getIndexes().length);
