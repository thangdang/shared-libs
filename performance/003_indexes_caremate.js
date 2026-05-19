/**
 * CareMate AI — MongoDB Compound Indexes
 * Run: mongosh caremate_vn < 003_indexes_caremate.js
 * 
 * Critical for performance when consultations > 20K, drugs > 5K
 */

print("=== CareMate AI — Creating Performance Indexes ===");

// Symptoms — RAG retrieval
db.symptoms.createIndex({ name_vi: "text", aliases: "text" }, { name: "idx_symptom_text", default_language: "none" });
db.symptoms.createIndex({ category: 1 }, { name: "idx_symptom_category" });

// Conditions — RAG retrieval
db.conditions.createIndex({ name_vi: "text", symptoms: "text" }, { name: "idx_condition_text", default_language: "none" });
db.conditions.createIndex({ icd_code: 1 }, { unique: true, sparse: true, name: "idx_icd_code" });

// Drugs — search + lookup
db.drugs.createIndex({ name_vi: "text", generic_name: "text", brand_names: "text" }, { name: "idx_drug_text", default_language: "none" });
db.drugs.createIndex({ generic_name: 1 }, { name: "idx_drug_generic" });
db.drugs.createIndex({ category: 1, is_otc: 1 }, { name: "idx_drug_category_otc" });
db.drugs.createIndex({ "interactions.drug_id": 1 }, { name: "idx_drug_interactions" });

// Drug products — brand variants + pricing
db.drug_products.createIndex({ drug_id: 1, pharmacy_chain: 1 }, { name: "idx_drug_product_chain" });
db.drug_products.createIndex({ name: "text" }, { name: "idx_drug_product_text", default_language: "none" });

// Pharmacies — geo-search
db.pharmacies.createIndex({ location: "2dsphere" }, { name: "idx_pharmacy_geo" });
db.pharmacies.createIndex({ chain: 1, is_24h: 1 }, { name: "idx_pharmacy_chain_24h" });
db.pharmacies.createIndex({ province: 1, chain: 1 }, { name: "idx_pharmacy_province" });

// Consultations — user history
db.consultations.createIndex({ user_id: 1, created_at: -1 }, { name: "idx_user_consultations" });
db.consultations.createIndex({ severity: 1, created_at: -1 }, { name: "idx_severity_date" });

// AI output logs — quality monitoring
db.ai_output_logs.createIndex({ created_at: -1 }, { name: "idx_ai_logs_date" });
db.ai_output_logs.createIndex({ severity: 1, created_at: -1 }, { name: "idx_ai_logs_severity" });
db.ai_output_logs.createIndex({ created_at: 1 }, { expireAfterSeconds: 7776000, name: "idx_ai_logs_ttl_90d" }); // 90 days

// Health articles — content
db.health_articles.createIndex({ category: 1, published_at: -1 }, { name: "idx_article_category" });
db.health_articles.createIndex({ slug: 1 }, { unique: true, name: "idx_article_slug" });
db.health_articles.createIndex({ title: "text", content: "text" }, { name: "idx_article_text", default_language: "none" });

// Users
db.users.createIndex({ email: 1 }, { unique: true, sparse: true, name: "idx_email_unique" });
db.users.createIndex({ phone: 1 }, { unique: true, sparse: true, name: "idx_phone_unique" });

// Sessions — TTL
db.sessions.createIndex({ created_at: 1 }, { expireAfterSeconds: 604800, name: "idx_session_ttl_7d" });

print("=== CareMate indexes created ===");
print("Total indexes on drugs: " + db.drugs.getIndexes().length);
print("Total indexes on pharmacies: " + db.pharmacies.getIndexes().length);
