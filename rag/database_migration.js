/**
 * RAG Trusted Data — MongoDB Collections & Indexes
 * Run this migration on each engine's database.
 *
 * Collections:
 * - rag_logs: Track RAG queries for quality monitoring
 * - rag_feedback: User quality ratings
 *
 * Indexes added to existing collections for RAG performance.
 */

// ═══════════════════════════════════════
// RAG Logs (all engines)
// ═══════════════════════════════════════
db.createCollection("rag_logs");
db.rag_logs.createIndex({ "engine": 1, "created_at": -1 });
db.rag_logs.createIndex({ "created_at": 1 }, { expireAfterSeconds: 2592000 }); // 30-day TTL
db.rag_logs.createIndex({ "validation.valid": 1 }); // For hallucination rate queries

// ═══════════════════════════════════════
// RAG Feedback
// ═══════════════════════════════════════
db.createCollection("rag_feedback");
db.rag_feedback.createIndex({ "rag_log_id": 1 });
db.rag_feedback.createIndex({ "rating": 1, "created_at": -1 });

// ═══════════════════════════════════════
// SmartBuy: Reviews need product_id index for filtered retrieval
// ═══════════════════════════════════════
db.reviews.createIndex({ "product_id": 1, "rating": -1 });

// ═══════════════════════════════════════
// FinTax: Transactions need user_id + date for fast aggregation
// ═══════════════════════════════════════
db.transactions.createIndex({ "user_id": 1, "date": -1, "category": 1 });
db.transactions.createIndex({ "user_id": 1, "anomaly_score": -1 });

// ═══════════════════════════════════════
// CareMate: Drugs need is_otc filter
// ═══════════════════════════════════════
db.drugs.createIndex({ "is_otc": 1, "category": 1 });
db.drug_products.createIndex({ "drug_id": 1, "pharmacy_chain": 1 });

// ═══════════════════════════════════════
// Childhood: Scripts need niche + score for winner retrieval
// ═══════════════════════════════════════
db.scripts.createIndex({ "niche_id": 1, "metadata.prediction.score": -1 });
db.scripts.createIndex({ "channel_id": 1, "metadata.retention_score": -1 });
db.trendingpatterns.createIndex({ "niche_id": 1, "created_at": -1 });

// ═══════════════════════════════════════
// TrendBrief: Articles need topic + date for filtered retrieval
// ═══════════════════════════════════════
db.articles.createIndex({ "topic": 1, "created_at": -1 });
db.articles.createIndex({ "source": 1, "created_at": -1 });

print("✅ RAG Trusted Data collections and indexes created successfully");
