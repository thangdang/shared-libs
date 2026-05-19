/**
 * FIN Tax AI — MongoDB Compound Indexes
 * Run: mongosh fintax_ai < 004_indexes_fintax.js
 * 
 * Critical for performance when transactions > 50K per user
 */

print("=== FIN Tax AI — Creating Performance Indexes ===");

// Transactions — user queries (most common)
db.transactions.createIndex({ user_id: 1, date: -1 }, { name: "idx_user_date" });
db.transactions.createIndex({ user_id: 1, category: 1, date: -1 }, { name: "idx_user_category_date" });
db.transactions.createIndex({ user_id: 1, type: 1, date: -1 }, { name: "idx_user_type_date" });
db.transactions.createIndex({ user_id: 1, date: -1, category: 1, amount: 1 }, { name: "idx_user_dashboard" });

// Transactions — anomaly detection
db.transactions.createIndex({ user_id: 1, category: 1, amount: 1 }, { name: "idx_anomaly_detection" });

// Budgets — user lookup
db.budgets.createIndex({ user_id: 1, month: 1 }, { unique: true, name: "idx_user_budget_month" });
db.budgets.createIndex({ user_id: 1, category: 1, month: 1 }, { name: "idx_user_category_budget" });

// Invoices — OCR results
db.invoices.createIndex({ user_id: 1, created_at: -1 }, { name: "idx_user_invoices" });

// Tax rules — lookup
db.tax_rules.createIndex({ type: 1, effective_year: 1 }, { name: "idx_tax_rules_type_year" });

// AI chat history
db.ai_conversations.createIndex({ user_id: 1, created_at: -1 }, { name: "idx_user_conversations" });
db.ai_conversations.createIndex({ user_id: 1, created_at: 1 }, { expireAfterSeconds: 7776000, name: "idx_conversations_ttl_90d" });

// Users
db.users.createIndex({ email: 1 }, { unique: true, sparse: true, name: "idx_email_unique" });

// Sessions — TTL
db.sessions.createIndex({ created_at: 1 }, { expireAfterSeconds: 604800, name: "idx_session_ttl_7d" });

// Subscriptions
db.subscriptions.createIndex({ user_id: 1, status: 1 }, { name: "idx_user_subscription" });
db.subscriptions.createIndex({ expires_at: 1, status: 1 }, { name: "idx_subscription_expiry" });

print("=== FIN Tax indexes created ===");
print("Total indexes on transactions: " + db.transactions.getIndexes().length);
