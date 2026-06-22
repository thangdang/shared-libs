/**
 * Doctor Car AI — MongoDB Compound Indexes
 * Run: mongosh doctor_car_ai < 012_indexes_doctorcar.js
 *
 * Critical for performance when diagnoses > 10K, garages > 1K
 */

print("=== Doctor Car AI — Creating Performance Indexes ===");

// Diagnoses — user history + vehicle lookup
db.diagnoses.createIndex({ user_id: 1, created_at: -1 }, { name: "idx_diagnosis_user_date" });
db.diagnoses.createIndex({ vehicle_id: 1 }, { name: "idx_diagnosis_vehicle" });

// Articles — content listing + filtering
db.articles.createIndex({ status: 1, published_at: -1 }, { name: "idx_article_status_date" });
db.articles.createIndex({ category: 1 }, { name: "idx_article_category" });
db.articles.createIndex({ tags: 1 }, { name: "idx_article_tags" });

// Garages — geo-search + active/verified filtering
db.garages.createIndex({ location: "2dsphere" }, { name: "idx_garage_geo" });
db.garages.createIndex({ is_active: 1, is_verified: 1 }, { name: "idx_garage_active_verified" });

// Subscriptions — user lookup + expiry management
db.subscriptions.createIndex({ user_id: 1, status: 1 }, { name: "idx_subscription_user_status" });
db.subscriptions.createIndex({ expires_at: 1 }, { name: "idx_subscription_expiry" });

// Job Queue — worker polling
db.job_queue.createIndex({ status: 1, type: 1, locked_at: 1 }, { name: "idx_job_queue_poll" });

// Notifications — user feed
db.notifications.createIndex({ user_id: 1, created_at: -1 }, { name: "idx_notification_user_date" });

// Affiliate Clicks — tracking + reporting
db.affiliate_clicks.createIndex({ user_id: 1 }, { name: "idx_affiliate_user" });
db.affiliate_clicks.createIndex({ partner: 1, clicked_at: -1 }, { name: "idx_affiliate_partner_date" });

print("=== Doctor Car AI indexes created ===");
print("Total indexes on diagnoses: " + db.diagnoses.getIndexes().length);
print("Total indexes on garages: " + db.garages.getIndexes().length);
print("Total indexes on job_queue: " + db.job_queue.getIndexes().length);
