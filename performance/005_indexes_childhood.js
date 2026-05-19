/**
 * Childhood Video Engine — MongoDB Compound Indexes
 * Run: mongosh childhood < 005_indexes_childhood.js
 */

print("=== Childhood Video Engine — Creating Performance Indexes ===");

// Videos — listing + filtering
db.videos.createIndex({ channel_id: 1, status: 1, created_at: -1 }, { name: "idx_channel_status_date" });
db.videos.createIndex({ niche: 1, status: 1, created_at: -1 }, { name: "idx_niche_status_date" });
db.videos.createIndex({ is_winner: 1, score: -1 }, { name: "idx_winners" });

// Scripts — lookup + quality
db.scripts.createIndex({ video_id: 1 }, { name: "idx_script_video" });
db.scripts.createIndex({ niche: 1, score: -1, created_at: -1 }, { name: "idx_script_quality" });

// Performances — analytics
db.performances.createIndex({ video_id: 1, recorded_at: -1 }, { name: "idx_perf_video_date" });
db.performances.createIndex({ channel_id: 1, recorded_at: -1 }, { name: "idx_perf_channel_date" });

// Content items — niche content
db.contentitems.createIndex({ niche: 1, used: 1 }, { name: "idx_content_niche_used" });

// Channels
db.channels.createIndex({ is_active: 1, platform: 1 }, { name: "idx_channel_active_platform" });

// Trending patterns
db.trendingpatterns.createIndex({ detected_at: -1, score: -1 }, { name: "idx_trending_score" });

// Feedback datasets — learning
db.feedbackdatasets.createIndex({ niche: 1, is_winner: 1, created_at: -1 }, { name: "idx_feedback_niche" });

// Upload queue
db.upload_queue.createIndex({ status: 1, scheduled_at: 1 }, { name: "idx_upload_schedule" });

print("=== Childhood indexes created ===");
print("Total indexes on videos: " + db.videos.getIndexes().length);
