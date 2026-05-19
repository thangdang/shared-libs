/**
 * TrendBrief AI — MongoDB Compound Indexes
 * Run: mongosh trendbriefai < 002_indexes_trendbriefai.js
 * 
 * Critical for performance when articles > 50K
 */

print("=== TrendBrief AI — Creating Performance Indexes ===");

// Articles — feed queries (most common)
db.articles.createIndex({ topic: 1, published_at: -1, processing_status: 1 }, { name: "idx_feed_topic" });
db.articles.createIndex({ processing_status: 1, created_at: -1 }, { name: "idx_status_created" });
db.articles.createIndex({ published_at: -1, processing_status: 1 }, { name: "idx_published_status" });

// Articles — dedup
db.articles.createIndex({ source: 1, url_hash: 1 }, { unique: true, name: "idx_source_url_dedup" });
db.articles.createIndex({ title_hash: 1 }, { sparse: true, name: "idx_title_hash" });

// Articles — text search
db.articles.createIndex({ title_ai: "text", title_original: "text" }, { name: "idx_article_text", default_language: "none" });

// Articles — trending detection
db.articles.createIndex({ topic: 1, created_at: -1 }, { name: "idx_topic_created" });

// Trending topics
db.trending_topics.createIndex({ velocity_ratio: -1, updated_at: -1 }, { name: "idx_trending_velocity" });
db.trending_topics.createIndex({ topic: 1 }, { unique: true, name: "idx_trending_topic_unique" });

// RSS sources — scheduler
db.rss_sources.createIndex({ is_active: 1, next_crawl_at: 1 }, { name: "idx_source_scheduler" });
db.rss_sources.createIndex({ "health.consecutive_failures": 1, is_active: 1 }, { name: "idx_source_health" });

// Bookmarks — user feed
db.bookmarks.createIndex({ user_id: 1, created_at: -1 }, { name: "idx_user_bookmarks" });
db.bookmarks.createIndex({ user_id: 1, article_id: 1 }, { unique: true, name: "idx_user_article_unique" });

// Interactions — implicit interest learning
db.interactions.createIndex({ user_id: 1, action: 1, created_at: -1 }, { name: "idx_user_interactions" });
db.interactions.createIndex({ article_id: 1, action: 1 }, { name: "idx_article_actions" });

// Users
db.users.createIndex({ email: 1 }, { unique: true, sparse: true, name: "idx_email_unique" });

// Sessions — TTL
db.sessions.createIndex({ created_at: 1 }, { expireAfterSeconds: 604800, name: "idx_session_ttl_7d" });

// Push subscriptions
db.push_subscriptions.createIndex({ user_id: 1 }, { name: "idx_push_user" });
db.push_subscriptions.createIndex({ topics: 1 }, { name: "idx_push_topics" });

print("=== TrendBrief indexes created ===");
print("Total indexes on articles: " + db.articles.getIndexes().length);
