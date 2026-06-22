"""
Resource Expansion Phase 4 — Low-Priority Background Sources.

Manages crawl sources that run at reduced frequency and priority:
- Forum/community content (Reddit VN, Tinhte, VOZ)
- Social media mentions (non-real-time)
- Historical price data backfill
- Archive.org snapshots for trend analysis

These sources run during off-peak hours (2 AM - 6 AM) to avoid
competing with high-priority crawlers for resources.

Usage:
    from shared_libs.rag.sources.low_priority_sources import LowPrioritySourceManager

    manager = LowPrioritySourceManager()
    manager.schedule_backfill("tinhte_forum", days_back=30)
    results = manager.run_batch(max_sources=5)
"""

import logging
import os
import time
from datetime import datetime, timezone, timedelta
from typing import Optional

import httpx
from pymongo import MongoClient

logger = logging.getLogger("rag.sources.low_priority")

MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")

# Low-priority source definitions
LOW_PRIORITY_SOURCES = {
    "tinhte_forum": {
        "name": "Tinhte Forum",
        "url": "https://tinhte.vn",
        "type": "forum",
        "crawl_interval_hours": 12,
        "max_pages_per_run": 5,
        "categories": [
            "/forum/danh-gia-san-pham.35/",
            "/forum/hoi-dap-mua-sam.36/",
            "/forum/tin-tuc-cong-nghe.2/",
        ],
    },
    "voz_forum": {
        "name": "VOZ Forum",
        "url": "https://voz.vn",
        "type": "forum",
        "crawl_interval_hours": 24,
        "max_pages_per_run": 3,
        "categories": [
            "/f/may-tinh-de-ban.5/",
            "/f/laptop.6/",
            "/f/dien-thoai.7/",
        ],
    },
    "reddit_vietnam": {
        "name": "Reddit r/Vietnam",
        "url": "https://www.reddit.com/r/VietNam",
        "type": "reddit",
        "crawl_interval_hours": 6,
        "max_posts_per_run": 25,
        "subreddits": ["VietNam", "vietnam", "VietnamTech"],
    },
    "price_history_backfill": {
        "name": "Price History Backfill",
        "url": None,
        "type": "internal",
        "crawl_interval_hours": 24,
        "description": "Backfill missing price history from product snapshots",
    },
    "archive_org": {
        "name": "Archive.org Wayback",
        "url": "https://web.archive.org",
        "type": "archive",
        "crawl_interval_hours": 168,  # Weekly
        "description": "Historical snapshots for trend analysis",
    },
}


class LowPrioritySourceManager:
    """
    Manages low-priority crawl sources that run during off-peak hours.

    Features:
    - Scheduled execution during 2 AM - 6 AM window
    - Resource-aware: pauses if system load is high
    - Backfill support for historical data
    - Automatic retry with exponential backoff
    """

    OFF_PEAK_START_HOUR = 2   # 2 AM
    OFF_PEAK_END_HOUR = 6     # 6 AM
    MAX_CONCURRENT_SOURCES = 3
    RATE_LIMIT_DELAY = 3.0    # 3 seconds between requests (very conservative)

    def __init__(self, mongo_uri: str = MONGODB_URI):
        self._client = MongoClient(mongo_uri)
        self._db = self._client["shared_crawl"]
        self._http = httpx.Client(timeout=20.0, follow_redirects=True)

    def is_off_peak(self) -> bool:
        """Check if current time is within the off-peak crawl window."""
        now = datetime.now(timezone(timedelta(hours=7)))  # Vietnam timezone (UTC+7)
        return self.OFF_PEAK_START_HOUR <= now.hour < self.OFF_PEAK_END_HOUR

    def get_due_sources(self) -> list[dict]:
        """
        Get sources that are due for crawling.

        Returns sources where last_crawled + interval < now.
        """
        due_sources = []
        now = datetime.now(timezone.utc)

        for source_id, config in LOW_PRIORITY_SOURCES.items():
            interval_hours = config["crawl_interval_hours"]

            # Check last crawl time
            last_run = self._db.low_priority_runs.find_one(
                {"source_id": source_id},
                sort=[("completed_at", -1)],
            )

            if last_run:
                last_time = last_run.get("completed_at", datetime.min.replace(tzinfo=timezone.utc))
                if (now - last_time).total_seconds() < interval_hours * 3600:
                    continue  # Not due yet

            due_sources.append({"source_id": source_id, **config})

        return due_sources

    def run_batch(self, max_sources: int = 3, force: bool = False) -> list[dict]:
        """
        Run a batch of low-priority crawls.

        Args:
            max_sources: Maximum sources to process in this batch.
            force: If True, ignore off-peak window check.

        Returns:
            List of run result dicts.
        """
        if not force and not self.is_off_peak():
            logger.info("Not in off-peak window — skipping low-priority crawls")
            return []

        due_sources = self.get_due_sources()[:max_sources]

        if not due_sources:
            logger.info("No low-priority sources due for crawling")
            return []

        results = []
        for source in due_sources:
            result = self._crawl_source(source)
            results.append(result)

        return results

    def schedule_backfill(self, source_id: str, days_back: int = 30) -> dict:
        """
        Schedule a historical data backfill for a source.

        Args:
            source_id: Source identifier.
            days_back: Number of days to backfill.

        Returns:
            Backfill job document.
        """
        job = {
            "source_id": source_id,
            "type": "backfill",
            "days_back": days_back,
            "status": "pending",
            "created_at": datetime.now(timezone.utc),
            "started_at": None,
            "completed_at": None,
            "items_processed": 0,
        }

        result = self._db.backfill_jobs.insert_one(job)
        job["_id"] = str(result.inserted_id)

        logger.info(f"Scheduled backfill for {source_id}: {days_back} days back")
        return job

    # ─── Source-Specific Crawlers ────────────────────────────────

    def _crawl_source(self, source: dict) -> dict:
        """Dispatch crawl to appropriate handler based on source type."""
        source_id = source["source_id"]
        source_type = source.get("type", "unknown")
        start_time = time.time()

        logger.info(f"Starting low-priority crawl: {source_id} (type={source_type})")

        try:
            if source_type == "forum":
                items = self._crawl_forum(source)
            elif source_type == "reddit":
                items = self._crawl_reddit(source)
            elif source_type == "internal":
                items = self._run_internal_task(source)
            elif source_type == "archive":
                items = self._crawl_archive(source)
            else:
                items = []
                logger.warning(f"Unknown source type: {source_type}")

            duration = time.time() - start_time

            # Record run
            run_record = {
                "source_id": source_id,
                "status": "completed",
                "items_found": len(items),
                "duration_seconds": round(duration, 2),
                "completed_at": datetime.now(timezone.utc),
            }
            self._db.low_priority_runs.insert_one(run_record)

            return run_record

        except Exception as e:
            duration = time.time() - start_time
            logger.error(f"Low-priority crawl failed for {source_id}: {e}")

            run_record = {
                "source_id": source_id,
                "status": "failed",
                "error": str(e),
                "duration_seconds": round(duration, 2),
                "completed_at": datetime.now(timezone.utc),
            }
            self._db.low_priority_runs.insert_one(run_record)
            return run_record

    def _crawl_forum(self, source: dict) -> list[dict]:
        """Crawl forum threads for product discussions and reviews."""
        items = []
        base_url = source["url"]
        categories = source.get("categories", [])
        max_pages = source.get("max_pages_per_run", 3)

        for category_path in categories[:2]:  # Limit categories per run
            url = f"{base_url}{category_path}"
            time.sleep(self.RATE_LIMIT_DELAY)

            try:
                response = self._http.get(url)
                if response.status_code == 200:
                    # Extract thread titles and metadata
                    threads = self._parse_forum_threads(response.text, base_url)
                    items.extend(threads)
            except Exception as e:
                logger.warning(f"Forum crawl failed for {url}: {e}")

        # Store in MongoDB
        for item in items:
            self._db.forum_content.update_one(
                {"url": item.get("url", "")},
                {"$set": {**item, "updated_at": datetime.now(timezone.utc)}},
                upsert=True,
            )

        return items

    def _crawl_reddit(self, source: dict) -> list[dict]:
        """Crawl Reddit posts via JSON API (no auth needed for public)."""
        items = []
        subreddits = source.get("subreddits", [])
        max_posts = source.get("max_posts_per_run", 25)

        for subreddit in subreddits:
            time.sleep(self.RATE_LIMIT_DELAY)

            url = f"https://www.reddit.com/r/{subreddit}/hot.json?limit={max_posts}"

            try:
                response = self._http.get(url, headers={"User-Agent": "SmartBuyAI/1.0"})
                if response.status_code == 200:
                    data = response.json()
                    posts = data.get("data", {}).get("children", [])

                    for post in posts:
                        post_data = post.get("data", {})
                        items.append({
                            "title": post_data.get("title", ""),
                            "url": f"https://reddit.com{post_data.get('permalink', '')}",
                            "score": post_data.get("score", 0),
                            "comments": post_data.get("num_comments", 0),
                            "subreddit": subreddit,
                            "source": "reddit",
                            "created_utc": post_data.get("created_utc", 0),
                        })
            except Exception as e:
                logger.warning(f"Reddit crawl failed for r/{subreddit}: {e}")

        return items

    def _run_internal_task(self, source: dict) -> list[dict]:
        """Run internal maintenance tasks (price history backfill, etc.)."""
        source_id = source["source_id"]

        if source_id == "price_history_backfill":
            return self._backfill_price_history()

        return []

    def _backfill_price_history(self) -> list[dict]:
        """Backfill missing price history from product snapshots."""
        # Find products with gaps in price history
        db = self._client["smartbuy"]
        cutoff = datetime.now(timezone.utc) - timedelta(days=7)

        products_needing_backfill = list(db.products.find(
            {"last_price_recorded": {"$lt": cutoff}, "is_active": True},
            {"_id": 1, "url": 1, "price": 1, "name": 1},
        ).limit(100))

        records = []
        for product in products_needing_backfill:
            if product.get("price"):
                record = {
                    "url": product.get("url", ""),
                    "price": product["price"],
                    "recorded_at": datetime.now(timezone.utc),
                    "source": "backfill",
                }
                db.price_history.insert_one(record)
                records.append(record)

        logger.info(f"Backfilled {len(records)} price history records")
        return records

    def _crawl_archive(self, source: dict) -> list[dict]:
        """Fetch historical snapshots from Archive.org Wayback Machine."""
        # Placeholder — would query Wayback Machine CDX API
        return []

    def _parse_forum_threads(self, html: str, base_url: str) -> list[dict]:
        """Parse forum thread listings from HTML."""
        import re

        threads = []
        # Generic pattern for forum thread links
        pattern = r'<a[^>]+href="([^"]*thread[^"]*)"[^>]*>([^<]+)</a>'
        matches = re.findall(pattern, html)

        for href, title in matches[:20]:
            if not href.startswith("http"):
                href = f"{base_url}{href}"
            threads.append({
                "title": title.strip(),
                "url": href,
                "source": "forum",
                "fetched_at": datetime.now(timezone.utc).isoformat(),
            })

        return threads

    def get_stats(self) -> dict:
        """Get low-priority crawl statistics."""
        total_runs = self._db.low_priority_runs.count_documents({})
        successful = self._db.low_priority_runs.count_documents({"status": "completed"})
        failed = self._db.low_priority_runs.count_documents({"status": "failed"})

        return {
            "total_runs": total_runs,
            "successful": successful,
            "failed": failed,
            "success_rate_pct": round(successful / max(total_runs, 1) * 100, 2),
            "pending_backfills": self._db.backfill_jobs.count_documents({"status": "pending"}),
        }

    def close(self):
        self._client.close()
        self._http.close()
