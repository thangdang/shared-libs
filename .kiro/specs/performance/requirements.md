# Performance Optimization — Requirements

> Prevent slow queries, memory overflow, and degraded UX as data scales
> Applied at deployment time (Release 1) — zero additional cost
> Updated: May 11, 2026

---

## Req 1: MongoDB Index Optimization

- Req 1.1: All frequently queried collections must have compound indexes matching query patterns (no collection scans on >10K docs)
- Req 1.2: Text search indexes on all user-facing search fields (Vietnamese, language: "none")
- Req 1.3: TTL indexes on ephemeral data (sessions: 7d, OTP: 5min, AI logs: 90d, completed jobs: 24h)
- Req 1.4: Geo-spatial index on pharmacy locations (2dsphere for $nearSphere queries)
- Req 1.5: Unique indexes on dedup fields (email, slug, url_hash, source+source_id)

---

## Req 2: Query Pagination

- Req 2.1: All list APIs must use cursor-based pagination (not skip/offset) for collections >10K docs
- Req 2.2: Cursor key must be indexed field (_id or published_at or created_at)
- Req 2.3: Default page size: 20 items. Max allowed: 100 items.
- Req 2.4: Response must include `nextCursor` field for client to request next page

---

## Req 3: MongoDB Memory Management

- Req 3.1: WiredTiger cache limited to 1GB (on 4GB VPS, default 2GB is too much)
- Req 3.2: Slow query profiling enabled (log queries >100ms)
- Req 3.3: Connection pool sized appropriately (maxPoolSize: 20, minPoolSize: 5)
- Req 3.4: All queries must use `.lean()` (Mongoose) or projection to return only needed fields

---

## Req 4: Redis Memory Management

- Req 4.1: Max memory set to 512MB with LRU eviction policy
- Req 4.2: All cache keys must have TTL (no infinite keys except rate-limit counters)
- Req 4.3: Key namespacing per product (prefix: `tb:`, `sb:`, `cm:`, `ft:`, `ch:`)
- Req 4.4: BullMQ completed jobs auto-removed after 1h (max 1000 retained)
- Req 4.5: BullMQ failed jobs auto-removed after 24h (max 5000 retained)

---

## Req 5: FAISS Vector Index

- Req 5.1: Use IndexFlatIP for <50K vectors, IndexIVFFlat for 50K-500K vectors
- Req 5.2: Incremental rebuild (add new vectors without full rebuild)
- Req 5.3: Full rebuild runs in background (no query downtime during rebuild)
- Req 5.4: Rebuild schedule: every 6 hours (configurable via env var)

---

## Req 6: API Response Caching (Nginx)

- Req 6.1: Nginx proxy cache for public read-only endpoints (feed, products, trending)
- Req 6.2: Cache TTL: feed 5min, products 10min, trending 30min
- Req 6.3: Never cache: auth, payment, AI chat, POST requests
- Req 6.4: Gzip compression enabled for JSON, JS, CSS, SVG (min 1KB)
- Req 6.5: Static assets (Angular builds) cached 30 days with immutable header

---

## Req 7: Angular Web Performance

- Req 7.1: All routes lazy-loaded (no eager loading of feature modules)
- Req 7.2: Initial bundle size < 2MB (warning at 1.5MB)
- Req 7.3: Images use NgOptimizedImage with lazy loading
- Req 7.4: Virtual scrolling for lists >100 items (CDK ScrollingModule)
- Req 7.5: Core Web Vitals targets: LCP < 2.5s, CLS < 0.1, INP < 200ms

---

## Req 8: VPS Resource Monitoring

- Req 8.1: DigitalOcean alerts configured: CPU >80%, RAM >3.5GB, Disk >70%
- Req 8.2: UptimeRobot monitors all /health endpoints (5 services + 4 web apps)
- Req 8.3: Scaling trigger documented: when to upgrade from 4GB → 8GB VPS
- Req 8.4: PM2 cluster mode for CPU-bound services (2 instances per service)

---

## Req 9: Data Archival (Month 3+)

- Req 9.1: Price histories older than 90 days moved to archive collection
- Req 9.2: AI output logs older than 90 days auto-deleted (TTL index)
- Req 9.3: Archived data still accessible via separate API endpoint (cold storage)
- Req 9.4: Archival runs as scheduled job (weekly, off-peak hours)
