# Performance Optimization — Design

> Technical design decisions for each optimization area
> Updated: May 11, 2026

---

## 1. MongoDB Index Strategy

### Design Decision: Compound Indexes Over Single-Field

Single-field indexes only help if the query uses that exact field alone. Our queries always combine multiple fields:

```
// Typical SmartBuy query: category + price range + sort by date
db.products.find({ category: "phones", "offers.price": { $lte: 10000000 } }).sort({ updated_at: -1 })

// Without compound index: MongoDB scans ALL products, then filters
// With compound index { category: 1, "offers.price": 1, updated_at: -1 }: direct lookup
```

### Index Design Rules

| Rule | Rationale |
|------|-----------|
| Equality fields first | `{ category: 1, price: 1 }` not `{ price: 1, category: 1 }` |
| Sort field last | `{ topic: 1, published_at: -1 }` — sort uses index |
| Sparse for optional fields | `{ google_id: 1 }, { sparse: true }` — skip null values |
| Text index: language "none" | Vietnamese doesn't have built-in stemmer, use "none" |
| TTL for auto-cleanup | Sessions, OTP, logs — MongoDB deletes expired docs automatically |

### Per-Product Index Count

| Product | Collections Indexed | Total Indexes | Estimated Build Time |
|---------|-------------------|---------------|---------------------|
| SmartBuy | 6 | 12 | ~30s (on 10K docs) |
| TrendBrief | 7 | 13 | ~20s |
| CareMate | 8 | 14 | ~15s |
| FIN Tax | 6 | 10 | ~10s |
| Childhood | 7 | 8 | ~10s |

---

## 2. Cursor-Based Pagination

### Design Decision: Cursor Over Skip/Offset

```
// ❌ skip(10000) = MongoDB reads and discards 10000 docs → O(n)
db.articles.find().skip(10000).limit(20)  // Slow at page 500+

// ✅ Cursor = direct index seek → O(1) regardless of page number
db.articles.find({ _id: { $lt: ObjectId("last_seen_id") } }).limit(20)
```

### Cursor Implementation Pattern

```typescript
// Service layer
async function getFeed(cursor?: string, limit = 20) {
  const query: any = { processing_status: 'done' };
  
  if (cursor) {
    // Cursor is the _id of last item on previous page
    query._id = { $lt: new ObjectId(cursor) };
  }

  const items = await Article.find(query)
    .sort({ _id: -1 })
    .limit(limit + 1)  // Fetch 1 extra to check if more pages exist
    .lean();

  const hasMore = items.length > limit;
  if (hasMore) items.pop();  // Remove the extra item

  return {
    items,
    nextCursor: items.length > 0 ? items[items.length - 1]._id : null,
    hasMore,
  };
}
```

### Which Collections Use Cursor

| Collection | Cursor Field | Sort | Why |
|-----------|-------------|------|-----|
| articles (TrendBrief) | `_id` or `published_at` | DESC | Feed is time-ordered |
| products (SmartBuy) | `_id` | DESC | Product listing |
| price_histories | `recorded_at` | DESC | Time-series data |
| transactions (FIN Tax) | `date` | DESC | User's transaction list |
| consultations (CareMate) | `created_at` | DESC | History |

---

## 3. Redis Architecture

### Design Decision: Cache-Only Mode (No Persistence)

Redis is used purely as cache + queue. All data is reconstructable from MongoDB. Therefore:
- Disable RDB/AOF persistence (saves disk I/O)
- Use LRU eviction (auto-remove old keys when full)
- Accept data loss on Redis restart (cache rebuilds automatically)

### Key Namespace Design

```
Prefix format: {product}:{type}:{identifier}

tb:feed:{userId}:{topic}     → TrendBrief feed cache (TTL: 30min)
tb:article:{articleId}       → Article detail cache (TTL: 1h)
sb:product:{productId}       → SmartBuy product cache (TTL: 1h)
sb:price:{productId}         → Price history cache (TTL: 30min)
sb:ai:{queryHash}            → AI response cache (TTL: 24h)
cm:drug:{drugId}             → CareMate drug cache (TTL: 24h)
ft:tx:{userId}:{month}       → FIN Tax monthly summary (TTL: 1h)
ch:script:{videoId}          → Childhood script cache (TTL: 24h)
sess:{sessionId}             → User session (TTL: 7d)
rl:{ip}:{endpoint}           → Rate limit counter (TTL: 60s)
```

### Memory Budget (512MB Total)

| Category | Allocation | Keys (est.) |
|----------|-----------|-------------|
| Feed/article cache | 100MB | ~50K keys |
| Product/price cache | 150MB | ~30K keys |
| AI response cache | 100MB | ~10K keys |
| Sessions | 50MB | ~20K keys |
| BullMQ queues | 50MB | ~5K jobs |
| Rate limiting | 10MB | ~10K counters |
| Buffer | 52MB | — |

---

## 4. FAISS Index Architecture

### Design Decision: Tiered Index Strategy

| Vector Count | Index Type | Search Time | RAM Usage | Accuracy |
|-------------|-----------|-------------|-----------|----------|
| < 50K | IndexFlatIP | 5ms | ~150MB | 100% (exact) |
| 50K-500K | IndexIVFFlat | 15ms | ~200MB | ~95% (approximate) |
| > 500K | IndexIVFPQ | 5ms | ~50MB | ~90% (compressed) |

### Rebuild Strategy

```
┌─────────────────────────────────────────┐
│  Active Index (serving queries)          │
└─────────────────────────────────────────┘
                    ↑ atomic swap
┌─────────────────────────────────────────┐
│  Background Builder                      │
│  1. Load new/updated docs from MongoDB   │
│  2. Generate embeddings                  │
│  3. Build new FAISS index                │
│  4. Swap pointer (zero downtime)         │
└─────────────────────────────────────────┘
```

- Full rebuild: every 6 hours (cron)
- Incremental: add new vectors immediately (no rebuild needed for IndexFlatIP)
- Swap is atomic: old index garbage-collected after swap

---

## 5. Nginx Caching Architecture

### Design Decision: Selective Caching (Not Everything)

| Endpoint Pattern | Cache? | TTL | Why |
|-----------------|--------|-----|-----|
| `GET /api/*/feed` | ✅ | 5min | Same for all users, updates every 10min |
| `GET /api/*/products` | ✅ | 10min | Product list rarely changes |
| `GET /api/*/trending` | ✅ | 30min | Trending updates every 6h |
| `GET /api/*/health` | ✅ | 10s | Monitoring, low TTL |
| `POST /api/*/ai/*` | ❌ | — | Personalized, user-specific |
| `*/api/auth/*` | ❌ | — | Security-sensitive |
| `*/api/payment/*` | ❌ | — | Transaction-sensitive |
| `POST *` | ❌ | — | Mutations never cached |

### Cache Invalidation

No explicit invalidation needed — TTL-based expiry is sufficient because:
- Feed updates every 10 min → 5 min cache means max 5 min stale
- Products update hourly → 10 min cache is acceptable
- Trending updates every 6h → 30 min cache is fine

---

## 6. Angular Performance Architecture

### Design Decision: Lazy Loading + Virtual Scroll

```
Initial bundle (eager):
├── AppModule (shell, nav, auth)        ~200KB
├── SharedModule (common components)     ~100KB
└── Total initial:                       ~300KB

Lazy-loaded on navigation:
├── FeedModule                           ~150KB
├── ArticleDetailModule                  ~100KB
├── SearchModule                         ~80KB
├── PremiumModule                        ~60KB
├── ProfileModule                        ~50KB
└── Total lazy:                          ~440KB

Grand total: ~740KB (well under 2MB budget)
```

### Virtual Scroll Threshold

| Screen | Items | Virtual Scroll? | Why |
|--------|-------|----------------|-----|
| Feed (TrendBrief) | 100+ | ✅ Yes | Infinite scroll, 1000+ articles |
| Product list (SmartBuy) | 50+ | ✅ Yes | Grid with images, heavy DOM |
| Price history chart | 30-90 points | ❌ No | Chart handles internally |
| Drug list (CareMate) | 20-50 | ❌ No | Small list, no performance issue |
| Transaction list (FIN Tax) | 100+ | ✅ Yes | Monthly view can have 500+ items |

---

## 7. VPS Memory Layout (4GB)

```
Total RAM: 4096 MB
├── OS + system:           ~400 MB
├── MongoDB (WiredTiger):  1024 MB (capped)
├── Redis:                  512 MB (capped)
├── Nginx:                  ~50 MB
├── PM2 + 5 Node services: ~800 MB (160MB each)
├── Buffer/swap:           ~300 MB
└── Available:            ~1010 MB
```

### When to Upgrade (4GB → 8GB)

| Signal | Threshold | Action |
|--------|-----------|--------|
| PM2 services restarting (OOM) | Any service killed | Upgrade immediately |
| MongoDB cache hit ratio < 80% | `db.serverStatus().wiredTiger.cache` | Upgrade or optimize queries |
| Redis evictions > 1000/hour | `redis-cli INFO stats` | Increase maxmemory or upgrade |
| API p95 > 3s sustained | PM2 logs | Profile queries, then upgrade |
| Disk > 70% | DigitalOcean alert | Add volume or archive data |
