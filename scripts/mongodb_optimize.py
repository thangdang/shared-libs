#!/usr/bin/env python
"""
MongoDB Optimization Script for WinLux AI Apps
═══════════════════════════════════════════════

Performs periodic optimization tasks:
  1. Check collection sizes and alert on thresholds
  2. Apply TTL indexes for auto-cleanup
  3. Archive old data to separate collections
  4. Analyze slow queries and suggest indexes
  5. Generate optimization report

Usage:
  python mongodb_optimize.py --check          # Check sizes only
  python mongodb_optimize.py --apply-ttl      # Apply TTL indexes
  python mongodb_optimize.py --archive        # Archive old data
  python mongodb_optimize.py --analyze        # Analyze slow queries
  python mongodb_optimize.py --full           # Run all optimizations
  python mongodb_optimize.py --report         # Generate full report

Schedule with Windows Task Scheduler:
  - Daily: --check --report
  - Weekly: --archive
  - Monthly: --analyze --full

Author: WinLux Team
Last Updated: 2026-08-31
"""

import argparse
import json
import logging
import os
import sys
from dataclasses import dataclass
from dataclasses import field
from datetime import datetime
from datetime import timedelta
from enum import Enum
from pathlib import Path
from typing import Any

# ═══════════════════════════════════════════════════════════════════════════════
#  Configuration
# ═══════════════════════════════════════════════════════════════════════════════

MONGODB_URI = os.getenv("MONGODB_URI", "mongodb://localhost:27017")

# Database configurations for all apps
DATABASES = {
    "smartbuy": {
        "description": "SmartBuy AI - Price comparison & deals",
        "collections": {
            "products": {"threshold": 1_000_000, "archive_days": 180},
            "price_histories": {"threshold": 10_000_000, "ttl_days": 90},
            "crawl_logs": {"threshold": 500_000, "ttl_days": 30},
            "job_queue": {"threshold": 100_000, "ttl_days": 7},
            "price_alerts": {"threshold": 500_000, "archive_days": 365},
            "live_streams": {"threshold": 100_000, "ttl_days": 3},
            "flash_deals": {"threshold": 500_000, "ttl_days": 7},
            "cashback_offers": {"threshold": 100_000, "ttl_days": 30},
        },
    },
    "caremate_vn": {
        "description": "CareMate AI - Health symptom checker",
        "collections": {
            "consultations": {"threshold": 500_000, "archive_days": 730},
            "symptoms": {"threshold": 10_000, "archive_days": None},
            "drugs": {"threshold": 50_000, "archive_days": None},
            "telemedicine_bookings": {"threshold": 200_000, "archive_days": 365},
            "pharmacy_orders": {"threshold": 500_000, "archive_days": 365},
            "api_logs": {"threshold": 1_000_000, "ttl_days": 30},
        },
    },
    "trendbriefai": {
        "description": "TrendBrief AI - News aggregation",
        "collections": {
            "articles": {"threshold": 1_000_000, "archive_days": 365},
            "summaries": {"threshold": 1_000_000, "archive_days": 365},
            "rss_sources": {"threshold": 1_000, "archive_days": None},
            "trending_topics": {"threshold": 100_000, "ttl_days": 7},
            "tiktok_trends": {"threshold": 500_000, "ttl_days": 30},
            "video_scripts": {"threshold": 100_000, "archive_days": 180},
        },
    },
    "fintax_ai": {
        "description": "FinTax AI - Personal finance & tax",
        "collections": {
            "transactions": {"threshold": 5_000_000, "archive_days": 1825},  # 5 years
            "tax_calculations": {"threshold": 500_000, "archive_days": 2555},  # 7 years
            "wallet_imports": {"threshold": 1_000_000, "archive_days": 1825},
            "tax_rules": {"threshold": 1_000, "archive_days": None},
            "expense_categories": {"threshold": 10_000, "archive_days": None},
        },
    },
    "doctor_car_ai": {
        "description": "DoctorCar AI - Vehicle diagnostics",
        "collections": {
            "diagnoses": {"threshold": 200_000, "archive_days": 730},
            "vehicles": {"threshold": 100_000, "archive_days": None},
            "symptoms": {"threshold": 10_000, "archive_days": None},
            "garages": {"threshold": 50_000, "archive_days": None},
            "voice_transcripts": {"threshold": 500_000, "ttl_days": 90},
            "maintenance_logs": {"threshold": 500_000, "archive_days": 1095},  # 3 years
        },
    },
    "childhood": {
        "description": "AI Video Engine - Content generation",
        "collections": {
            "video_jobs": {"threshold": 100_000, "archive_days": 180},
            "scripts": {"threshold": 200_000, "archive_days": 365},
            "channel_identities": {"threshold": 1_000, "archive_days": None},
            "video_templates": {"threshold": 1_000, "archive_days": None},
            "shoppertainment_scripts": {"threshold": 100_000, "archive_days": 180},
            "job_queue": {"threshold": 50_000, "ttl_days": 7},
            "render_logs": {"threshold": 500_000, "ttl_days": 30},
        },
    },
    "backoffice": {
        "description": "Backoffice AI - Admin dashboard",
        "collections": {
            "audit_logs": {"threshold": 1_000_000, "archive_days": 730},
            "user_sessions": {"threshold": 100_000, "ttl_days": 1},
            "analytics_cache": {"threshold": 500_000, "ttl_days": 7},
        },
    },
}

# Index definitions for each collection
INDEX_DEFINITIONS = {
    "smartbuy": {
        "products": [
            {"keys": [("platform", 1), ("category", 1), ("updated_at", -1)]},
            {"keys": [("is_active", 1), ("price", 1)]},
            {"keys": [("name", "text"), ("description", "text")]},
        ],
        "price_histories": [
            {"keys": [("product_id", 1), ("recorded_at", -1)]},
            {"keys": [("recorded_at", 1)], "ttl": 7776000},  # 90 days
        ],
        "live_streams": [
            {"keys": [("status", 1), ("category", 1), ("started_at", -1)]},
            {"keys": [("ended_at", 1)], "ttl": 259200, "partial": {"status": "ended"}},
        ],
        "flash_deals": [
            {"keys": [("stream_id", 1), ("expires_at", 1)]},
        ],
        "cashback_offers": [
            {"keys": [("wallet", 1), ("category", 1), ("expires_at", 1)]},
        ],
    },
    "caremate_vn": {
        "consultations": [
            {"keys": [("user_id", 1), ("created_at", -1)]},
            {"keys": [("severity", 1), ("created_at", -1)]},
        ],
        "telemedicine_bookings": [
            {"keys": [("user_id", 1), ("status", 1), ("appointment_date", 1)]},
            {"keys": [("doctor_id", 1), ("appointment_date", 1)]},
        ],
        "pharmacy_orders": [
            {"keys": [("user_id", 1), ("status", 1), ("created_at", -1)]},
            {"keys": [("pharmacy", 1), ("status", 1)]},
        ],
    },
    "trendbriefai": {
        "articles": [
            {"keys": [("source", 1), ("published_at", -1)]},
            {"keys": [("category", 1), ("published_at", -1)]},
            {"keys": [("title", "text"), ("content", "text")]},
        ],
        "tiktok_trends": [
            {"keys": [("category", 1), ("velocity", 1), ("detected_at", -1)]},
            {"keys": [("hashtag", 1), ("detected_at", -1)]},
        ],
        "video_scripts": [
            {"keys": [("article_id", 1), ("created_at", -1)]},
            {"keys": [("format", 1), ("platform", 1)]},
        ],
    },
    "fintax_ai": {
        "transactions": [
            {"keys": [("user_id", 1), ("date", -1)]},
            {"keys": [("user_id", 1), ("category", 1), ("date", -1)]},
            {"keys": [("user_id", 1), ("wallet_type", 1), ("date", -1)]},
        ],
        "wallet_imports": [
            {"keys": [("user_id", 1), ("wallet_type", 1), ("imported_at", -1)]},
        ],
    },
    "doctor_car_ai": {
        "diagnoses": [
            {"keys": [("user_id", 1), ("created_at", -1)]},
            {"keys": [("vehicle_id", 1), ("created_at", -1)]},
        ],
        "voice_transcripts": [
            {"keys": [("diagnosis_id", 1)]},
            {"keys": [("created_at", 1)], "ttl": 7776000},  # 90 days
        ],
    },
    "childhood": {
        "video_jobs": [
            {"keys": [("channel_id", 1), ("status", 1), ("created_at", -1)]},
            {"keys": [("status", 1), ("priority", -1)]},
        ],
        "shoppertainment_scripts": [
            {"keys": [("template_type", 1), ("platform", 1), ("created_at", -1)]},
            {"keys": [("product_category", 1)]},
        ],
        "job_queue": [
            {"keys": [("status", 1), ("priority", -1), ("created_at", 1)]},
            {
                "keys": [("completed_at", 1)],
                "ttl": 604800,
                "partial": {"status": "completed"},
            },
        ],
    },
}

# ═══════════════════════════════════════════════════════════════════════════════
#  Data Classes
# ═══════════════════════════════════════════════════════════════════════════════


class AlertLevel(Enum):
    """Alert severity levels."""

    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


@dataclass
class CollectionStats:
    """Statistics for a single collection."""

    database: str
    collection: str
    doc_count: int
    size_bytes: int
    avg_doc_size: int
    index_count: int
    index_size_bytes: int
    threshold: int
    usage_percent: float
    alert_level: AlertLevel


@dataclass
class SlowQuery:
    """Information about a slow query."""

    database: str
    collection: str
    operation: str
    duration_ms: int
    query_shape: dict
    timestamp: datetime
    suggested_index: str | None = None


@dataclass
class ArchiveResult:
    """Result of an archive operation."""

    database: str
    collection: str
    archived_count: int
    deleted_count: int
    archive_collection: str
    duration_seconds: float


@dataclass
class OptimizationReport:
    """Full optimization report."""

    generated_at: datetime
    total_databases: int
    total_collections: int
    total_documents: int
    total_size_gb: float
    alerts: list[CollectionStats]
    slow_queries: list[SlowQuery]
    archive_results: list[ArchiveResult]
    index_changes: list[dict]
    recommendations: list[str]


# ═══════════════════════════════════════════════════════════════════════════════
#  Logging Setup
# ═══════════════════════════════════════════════════════════════════════════════

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
)
logger = logging.getLogger("mongodb_optimize")


# ═══════════════════════════════════════════════════════════════════════════════
#  MongoDB Optimizer Class
# ═══════════════════════════════════════════════════════════════════════════════


class MongoDBOptimizer:
    """MongoDB optimization toolkit for WinLux AI apps."""

    def __init__(self, uri: str = MONGODB_URI):
        """Initialize optimizer with MongoDB connection."""
        try:
            from pymongo import MongoClient

            self.client = MongoClient(uri, serverSelectionTimeoutMS=5000)
            # Test connection
            self.client.admin.command("ping")
            logger.info(f"Connected to MongoDB: {uri}")
        except ImportError:
            logger.error("pymongo not installed. Run: pip install pymongo")
            sys.exit(1)
        except Exception as e:
            logger.error(f"Failed to connect to MongoDB: {e}")
            sys.exit(1)

        self.stats: list[CollectionStats] = []
        self.slow_queries: list[SlowQuery] = []
        self.archive_results: list[ArchiveResult] = []
        self.index_changes: list[dict] = []
        self.recommendations: list[str] = []

    # ───────────────────────────────────────────────────────────────────────────
    #  1. Check Collection Sizes
    # ───────────────────────────────────────────────────────────────────────────

    def check_sizes(self) -> list[CollectionStats]:
        """Check collection sizes and return alerts."""
        logger.info("=" * 60)
        logger.info("CHECKING COLLECTION SIZES")
        logger.info("=" * 60)

        self.stats = []

        for db_name, db_config in DATABASES.items():
            try:
                db = self.client[db_name]
                existing_collections = set(db.list_collection_names())

                for coll_name, coll_config in db_config["collections"].items():
                    if coll_name not in existing_collections:
                        continue

                    try:
                        stats = db.command("collStats", coll_name)
                        doc_count = stats.get("count", 0)
                        size_bytes = stats.get("size", 0)
                        avg_doc_size = stats.get("avgObjSize", 0)
                        index_count = stats.get("nindexes", 0)
                        index_size = stats.get("totalIndexSize", 0)
                        threshold = coll_config["threshold"]

                        usage_percent = (
                            (doc_count / threshold * 100) if threshold > 0 else 0
                        )

                        if usage_percent >= 90:
                            alert_level = AlertLevel.CRITICAL
                        elif usage_percent >= 70:
                            alert_level = AlertLevel.WARNING
                        else:
                            alert_level = AlertLevel.INFO

                        stat = CollectionStats(
                            database=db_name,
                            collection=coll_name,
                            doc_count=doc_count,
                            size_bytes=size_bytes,
                            avg_doc_size=avg_doc_size,
                            index_count=index_count,
                            index_size_bytes=index_size,
                            threshold=threshold,
                            usage_percent=usage_percent,
                            alert_level=alert_level,
                        )
                        self.stats.append(stat)

                        # Log based on alert level
                        size_mb = size_bytes / (1024 * 1024)
                        if alert_level == AlertLevel.CRITICAL:
                            logger.warning(
                                f"🔴 CRITICAL: {db_name}.{coll_name}: "
                                f"{doc_count:,} docs ({usage_percent:.1f}%) - {size_mb:.1f} MB"
                            )
                        elif alert_level == AlertLevel.WARNING:
                            logger.warning(
                                f"🟡 WARNING: {db_name}.{coll_name}: "
                                f"{doc_count:,} docs ({usage_percent:.1f}%) - {size_mb:.1f} MB"
                            )
                        else:
                            logger.info(
                                f"🟢 OK: {db_name}.{coll_name}: "
                                f"{doc_count:,} docs ({usage_percent:.1f}%) - {size_mb:.1f} MB"
                            )

                    except Exception as e:
                        logger.debug(f"Could not get stats for {db_name}.{coll_name}: {e}")

            except Exception as e:
                logger.error(f"Error checking database {db_name}: {e}")

        # Summary
        alerts = [s for s in self.stats if s.alert_level != AlertLevel.INFO]
        logger.info("-" * 60)
        logger.info(
            f"Total: {len(self.stats)} collections checked, "
            f"{len(alerts)} alerts ({len([a for a in alerts if a.alert_level == AlertLevel.CRITICAL])} critical)"
        )

        return self.stats

    # ───────────────────────────────────────────────────────────────────────────
    #  2. Apply TTL Indexes
    # ───────────────────────────────────────────────────────────────────────────

    def apply_ttl_indexes(self, dry_run: bool = True) -> list[dict]:
        """Apply TTL indexes for auto-cleanup."""
        logger.info("=" * 60)
        logger.info(f"APPLYING TTL INDEXES {'(DRY RUN)' if dry_run else ''}")
        logger.info("=" * 60)

        changes = []

        for db_name, indexes in INDEX_DEFINITIONS.items():
            try:
                db = self.client[db_name]
                existing_collections = set(db.list_collection_names())

                for coll_name, index_list in indexes.items():
                    if coll_name not in existing_collections:
                        continue

                    coll = db[coll_name]
                    existing_indexes = {idx["name"]: idx for idx in coll.list_indexes()}

                    for index_def in index_list:
                        if "ttl" not in index_def:
                            continue

                        keys = index_def["keys"]
                        ttl_seconds = index_def["ttl"]
                        partial = index_def.get("partial")

                        # Build index name
                        key_parts = [f"{k}_{v}" for k, v in keys]
                        index_name = "_".join(key_parts) + "_ttl"

                        # Check if index exists
                        if index_name in existing_indexes:
                            logger.info(f"  ✓ TTL index exists: {db_name}.{coll_name}.{index_name}")
                            continue

                        # Create index
                        index_options = {
                            "name": index_name,
                            "expireAfterSeconds": ttl_seconds,
                        }
                        if partial:
                            index_options["partialFilterExpression"] = partial

                        change = {
                            "database": db_name,
                            "collection": coll_name,
                            "index_name": index_name,
                            "ttl_seconds": ttl_seconds,
                            "ttl_days": ttl_seconds / 86400,
                            "action": "create",
                        }

                        if dry_run:
                            logger.info(
                                f"  [DRY RUN] Would create TTL index: "
                                f"{db_name}.{coll_name}.{index_name} "
                                f"(expire after {ttl_seconds/86400:.0f} days)"
                            )
                        else:
                            try:
                                coll.create_index(keys, **index_options)
                                logger.info(
                                    f"  ✓ Created TTL index: {db_name}.{coll_name}.{index_name}"
                                )
                                change["status"] = "created"
                            except Exception as e:
                                logger.error(
                                    f"  ✗ Failed to create index {index_name}: {e}"
                                )
                                change["status"] = "failed"
                                change["error"] = str(e)

                        changes.append(change)

            except Exception as e:
                logger.error(f"Error processing database {db_name}: {e}")

        self.index_changes.extend(changes)
        logger.info(f"TTL index changes: {len(changes)}")
        return changes

    # ───────────────────────────────────────────────────────────────────────────
    #  3. Apply Regular Indexes
    # ───────────────────────────────────────────────────────────────────────────

    def apply_indexes(self, dry_run: bool = True) -> list[dict]:
        """Apply all defined indexes."""
        logger.info("=" * 60)
        logger.info(f"APPLYING INDEXES {'(DRY RUN)' if dry_run else ''}")
        logger.info("=" * 60)

        changes = []

        for db_name, indexes in INDEX_DEFINITIONS.items():
            try:
                db = self.client[db_name]
                existing_collections = set(db.list_collection_names())

                for coll_name, index_list in indexes.items():
                    if coll_name not in existing_collections:
                        continue

                    coll = db[coll_name]
                    existing_indexes = {idx["name"]: idx for idx in coll.list_indexes()}

                    for index_def in index_list:
                        keys = index_def["keys"]
                        ttl = index_def.get("ttl")
                        partial = index_def.get("partial")

                        # Build index name
                        key_parts = []
                        for k, v in keys:
                            if v == "text":
                                key_parts.append(f"{k}_text")
                            else:
                                key_parts.append(f"{k}_{v}")
                        index_name = "_".join(key_parts)
                        if ttl:
                            index_name += "_ttl"

                        # Check if index exists
                        if index_name in existing_indexes:
                            continue

                        # Build index options
                        index_options = {"name": index_name}
                        if ttl:
                            index_options["expireAfterSeconds"] = ttl
                        if partial:
                            index_options["partialFilterExpression"] = partial

                        change = {
                            "database": db_name,
                            "collection": coll_name,
                            "index_name": index_name,
                            "keys": keys,
                            "action": "create",
                        }

                        if dry_run:
                            logger.info(
                                f"  [DRY RUN] Would create index: "
                                f"{db_name}.{coll_name}.{index_name}"
                            )
                        else:
                            try:
                                coll.create_index(keys, **index_options)
                                logger.info(
                                    f"  ✓ Created index: {db_name}.{coll_name}.{index_name}"
                                )
                                change["status"] = "created"
                            except Exception as e:
                                logger.error(
                                    f"  ✗ Failed to create index {index_name}: {e}"
                                )
                                change["status"] = "failed"
                                change["error"] = str(e)

                        changes.append(change)

            except Exception as e:
                logger.error(f"Error processing database {db_name}: {e}")

        self.index_changes.extend(changes)
        logger.info(f"Index changes: {len(changes)}")
        return changes

    # ───────────────────────────────────────────────────────────────────────────
    #  4. Archive Old Data
    # ───────────────────────────────────────────────────────────────────────────

    def archive_old_data(self, dry_run: bool = True) -> list[ArchiveResult]:
        """Archive old data to separate collections."""
        logger.info("=" * 60)
        logger.info(f"ARCHIVING OLD DATA {'(DRY RUN)' if dry_run else ''}")
        logger.info("=" * 60)

        results = []

        for db_name, db_config in DATABASES.items():
            try:
                db = self.client[db_name]
                existing_collections = set(db.list_collection_names())

                for coll_name, coll_config in db_config["collections"].items():
                    archive_days = coll_config.get("archive_days")
                    if not archive_days or coll_name not in existing_collections:
                        continue

                    # Skip if TTL is set (auto-deleted)
                    if coll_config.get("ttl_days"):
                        continue

                    coll = db[coll_name]
                    archive_coll_name = f"{coll_name}_archive"
                    cutoff_date = datetime.utcnow() - timedelta(days=archive_days)

                    # Find date field (try common names)
                    date_fields = ["created_at", "updated_at", "date", "timestamp", "published_at"]
                    date_field = None

                    sample = coll.find_one()
                    if sample:
                        for field in date_fields:
                            if field in sample:
                                date_field = field
                                break

                    if not date_field:
                        logger.debug(
                            f"  Skipping {db_name}.{coll_name}: no date field found"
                        )
                        continue

                    # Count documents to archive
                    query = {date_field: {"$lt": cutoff_date}}
                    archive_count = coll.count_documents(query)

                    if archive_count == 0:
                        logger.info(
                            f"  ✓ {db_name}.{coll_name}: nothing to archive "
                            f"(cutoff: {cutoff_date.date()})"
                        )
                        continue

                    start_time = datetime.utcnow()

                    if dry_run:
                        logger.info(
                            f"  [DRY RUN] Would archive {archive_count:,} docs from "
                            f"{db_name}.{coll_name} to {archive_coll_name} "
                            f"(older than {archive_days} days)"
                        )
                        result = ArchiveResult(
                            database=db_name,
                            collection=coll_name,
                            archived_count=archive_count,
                            deleted_count=0,
                            archive_collection=archive_coll_name,
                            duration_seconds=0,
                        )
                    else:
                        try:
                            # Archive using aggregation $merge
                            pipeline = [
                                {"$match": query},
                                {
                                    "$merge": {
                                        "into": archive_coll_name,
                                        "whenMatched": "replace",
                                        "whenNotMatched": "insert",
                                    }
                                },
                            ]
                            coll.aggregate(pipeline)

                            # Delete archived documents
                            delete_result = coll.delete_many(query)

                            duration = (datetime.utcnow() - start_time).total_seconds()

                            logger.info(
                                f"  ✓ Archived {archive_count:,} docs from "
                                f"{db_name}.{coll_name} to {archive_coll_name}, "
                                f"deleted {delete_result.deleted_count:,} "
                                f"({duration:.1f}s)"
                            )

                            result = ArchiveResult(
                                database=db_name,
                                collection=coll_name,
                                archived_count=archive_count,
                                deleted_count=delete_result.deleted_count,
                                archive_collection=archive_coll_name,
                                duration_seconds=duration,
                            )

                        except Exception as e:
                            logger.error(
                                f"  ✗ Failed to archive {db_name}.{coll_name}: {e}"
                            )
                            continue

                    results.append(result)

            except Exception as e:
                logger.error(f"Error archiving database {db_name}: {e}")

        self.archive_results = results
        total_archived = sum(r.archived_count for r in results)
        logger.info(f"Archive results: {len(results)} collections, {total_archived:,} total docs")
        return results

    # ───────────────────────────────────────────────────────────────────────────
    #  5. Analyze Slow Queries
    # ───────────────────────────────────────────────────────────────────────────

    def analyze_slow_queries(self, slow_ms: int = 100) -> list[SlowQuery]:
        """Analyze slow queries from profiler."""
        logger.info("=" * 60)
        logger.info(f"ANALYZING SLOW QUERIES (>{slow_ms}ms)")
        logger.info("=" * 60)

        slow_queries = []

        for db_name in DATABASES.keys():
            try:
                db = self.client[db_name]

                # Enable profiling if not already
                try:
                    db.command("profile", 1, slowms=slow_ms)
                except Exception:
                    pass  # Profiling may already be enabled

                # Query system.profile
                try:
                    profile_coll = db["system.profile"]
                    cutoff = datetime.utcnow() - timedelta(days=1)

                    cursor = profile_coll.find(
                        {"ts": {"$gte": cutoff}, "millis": {"$gt": slow_ms}}
                    ).sort("millis", -1).limit(20)

                    for doc in cursor:
                        query_shape = doc.get("command", doc.get("query", {}))
                        collection = doc.get("ns", "").split(".")[-1]

                        # Suggest index based on query
                        suggested_index = self._suggest_index(query_shape)

                        slow_query = SlowQuery(
                            database=db_name,
                            collection=collection,
                            operation=doc.get("op", "unknown"),
                            duration_ms=doc.get("millis", 0),
                            query_shape=query_shape,
                            timestamp=doc.get("ts", datetime.utcnow()),
                            suggested_index=suggested_index,
                        )
                        slow_queries.append(slow_query)

                        logger.warning(
                            f"  🐢 {db_name}.{collection}: {doc.get('millis')}ms - "
                            f"{doc.get('op', 'unknown')}"
                        )
                        if suggested_index:
                            logger.info(f"     Suggested index: {suggested_index}")

                except Exception as e:
                    logger.debug(f"  Could not read profiler for {db_name}: {e}")

            except Exception as e:
                logger.error(f"Error analyzing {db_name}: {e}")

        self.slow_queries = slow_queries
        logger.info(f"Found {len(slow_queries)} slow queries")
        return slow_queries

    def _suggest_index(self, query_shape: dict) -> str | None:
        """Suggest an index based on query shape."""
        if not query_shape:
            return None

        # Extract filter fields
        filter_doc = query_shape.get("filter", query_shape.get("$match", {}))
        sort_doc = query_shape.get("sort", {})

        if not filter_doc and not sort_doc:
            return None

        fields = []

        # Add filter fields
        for key in filter_doc.keys():
            if not key.startswith("$"):
                fields.append((key, 1))

        # Add sort fields
        for key, direction in sort_doc.items():
            if (key, 1) not in fields and (key, -1) not in fields:
                fields.append((key, direction))

        if fields:
            return str(fields)

        return None

    # ───────────────────────────────────────────────────────────────────────────
    #  6. Find Unused Indexes
    # ───────────────────────────────────────────────────────────────────────────

    def find_unused_indexes(self) -> list[dict]:
        """Find indexes that haven't been used."""
        logger.info("=" * 60)
        logger.info("FINDING UNUSED INDEXES")
        logger.info("=" * 60)

        unused = []

        for db_name in DATABASES.keys():
            try:
                db = self.client[db_name]

                for coll_name in db.list_collection_names():
                    if coll_name.startswith("system."):
                        continue

                    try:
                        coll = db[coll_name]
                        stats = list(coll.aggregate([{"$indexStats": {}}]))

                        for stat in stats:
                            if stat["name"] == "_id_":
                                continue

                            ops = stat.get("accesses", {}).get("ops", 0)
                            if ops == 0:
                                unused.append({
                                    "database": db_name,
                                    "collection": coll_name,
                                    "index_name": stat["name"],
                                    "accesses": ops,
                                })
                                logger.info(
                                    f"  ⚠️  Unused index: {db_name}.{coll_name}.{stat['name']}"
                                )

                    except Exception as e:
                        logger.debug(f"Could not get index stats for {coll_name}: {e}")

            except Exception as e:
                logger.error(f"Error checking {db_name}: {e}")

        logger.info(f"Found {len(unused)} unused indexes")
        return unused

    # ───────────────────────────────────────────────────────────────────────────
    #  7. Generate Recommendations
    # ───────────────────────────────────────────────────────────────────────────

    def generate_recommendations(self) -> list[str]:
        """Generate optimization recommendations."""
        recommendations = []

        # Based on collection sizes
        critical_alerts = [s for s in self.stats if s.alert_level == AlertLevel.CRITICAL]
        for alert in critical_alerts:
            config = DATABASES.get(alert.database, {}).get("collections", {}).get(
                alert.collection, {}
            )
            if config.get("archive_days"):
                recommendations.append(
                    f"🔴 CRITICAL: {alert.database}.{alert.collection} at "
                    f"{alert.usage_percent:.0f}% capacity. "
                    f"Run archive (--archive) to move old data."
                )
            elif config.get("ttl_days"):
                recommendations.append(
                    f"🔴 CRITICAL: {alert.database}.{alert.collection} at "
                    f"{alert.usage_percent:.0f}% capacity. "
                    f"TTL index should auto-clean. Check if TTL index exists."
                )
            else:
                recommendations.append(
                    f"🔴 CRITICAL: {alert.database}.{alert.collection} at "
                    f"{alert.usage_percent:.0f}% capacity. "
                    f"Consider adding TTL or archive policy."
                )

        # Based on slow queries
        if self.slow_queries:
            collections_with_slow = set(
                f"{q.database}.{q.collection}" for q in self.slow_queries
            )
            recommendations.append(
                f"🐢 Found {len(self.slow_queries)} slow queries in "
                f"{len(collections_with_slow)} collections. "
                f"Review suggested indexes above."
            )

        # General recommendations
        total_size = sum(s.size_bytes for s in self.stats)
        if total_size > 10 * 1024 * 1024 * 1024:  # > 10GB
            recommendations.append(
                f"💾 Total data size is {total_size / (1024**3):.1f} GB. "
                f"Consider sharding for collections > 100GB."
            )

        self.recommendations = recommendations
        return recommendations

    # ───────────────────────────────────────────────────────────────────────────
    #  8. Generate Report
    # ───────────────────────────────────────────────────────────────────────────

    def generate_report(self, output_path: str | None = None) -> OptimizationReport:
        """Generate full optimization report."""
        logger.info("=" * 60)
        logger.info("GENERATING OPTIMIZATION REPORT")
        logger.info("=" * 60)

        # Run all checks if not already done
        if not self.stats:
            self.check_sizes()

        # Generate recommendations
        self.generate_recommendations()

        # Build report
        total_docs = sum(s.doc_count for s in self.stats)
        total_size = sum(s.size_bytes for s in self.stats)
        alerts = [s for s in self.stats if s.alert_level != AlertLevel.INFO]

        report = OptimizationReport(
            generated_at=datetime.utcnow(),
            total_databases=len(DATABASES),
            total_collections=len(self.stats),
            total_documents=total_docs,
            total_size_gb=total_size / (1024**3),
            alerts=alerts,
            slow_queries=self.slow_queries,
            archive_results=self.archive_results,
            index_changes=self.index_changes,
            recommendations=self.recommendations,
        )

        # Print summary
        logger.info("-" * 60)
        logger.info("REPORT SUMMARY")
        logger.info("-" * 60)
        logger.info(f"Generated: {report.generated_at}")
        logger.info(f"Databases: {report.total_databases}")
        logger.info(f"Collections: {report.total_collections}")
        logger.info(f"Total Documents: {report.total_documents:,}")
        logger.info(f"Total Size: {report.total_size_gb:.2f} GB")
        logger.info(f"Alerts: {len(report.alerts)}")
        logger.info(f"Slow Queries: {len(report.slow_queries)}")

        if report.recommendations:
            logger.info("-" * 60)
            logger.info("RECOMMENDATIONS")
            logger.info("-" * 60)
            for rec in report.recommendations:
                logger.info(f"  {rec}")

        # Save report to file
        if output_path:
            report_dict = {
                "generated_at": report.generated_at.isoformat(),
                "summary": {
                    "total_databases": report.total_databases,
                    "total_collections": report.total_collections,
                    "total_documents": report.total_documents,
                    "total_size_gb": round(report.total_size_gb, 2),
                },
                "alerts": [
                    {
                        "database": a.database,
                        "collection": a.collection,
                        "doc_count": a.doc_count,
                        "size_mb": round(a.size_bytes / (1024 * 1024), 2),
                        "usage_percent": round(a.usage_percent, 1),
                        "level": a.alert_level.value,
                    }
                    for a in report.alerts
                ],
                "slow_queries": [
                    {
                        "database": q.database,
                        "collection": q.collection,
                        "operation": q.operation,
                        "duration_ms": q.duration_ms,
                        "suggested_index": q.suggested_index,
                    }
                    for q in report.slow_queries
                ],
                "archive_results": [
                    {
                        "database": r.database,
                        "collection": r.collection,
                        "archived_count": r.archived_count,
                    }
                    for r in report.archive_results
                ],
                "recommendations": report.recommendations,
            }

            Path(output_path).parent.mkdir(parents=True, exist_ok=True)
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(report_dict, f, indent=2, ensure_ascii=False)
            logger.info(f"Report saved to: {output_path}")

        return report

    # ───────────────────────────────────────────────────────────────────────────
    #  9. Full Optimization
    # ───────────────────────────────────────────────────────────────────────────

    def run_full_optimization(self, dry_run: bool = True):
        """Run all optimization tasks."""
        logger.info("=" * 60)
        logger.info(f"FULL OPTIMIZATION {'(DRY RUN)' if dry_run else ''}")
        logger.info("=" * 60)

        # 1. Check sizes
        self.check_sizes()

        # 2. Apply indexes
        self.apply_indexes(dry_run=dry_run)

        # 3. Apply TTL indexes
        self.apply_ttl_indexes(dry_run=dry_run)

        # 4. Archive old data
        self.archive_old_data(dry_run=dry_run)

        # 5. Analyze slow queries
        self.analyze_slow_queries()

        # 6. Find unused indexes
        self.find_unused_indexes()

        # 7. Generate report
        report_path = f"mongodb_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
        self.generate_report(output_path=report_path)

        logger.info("=" * 60)
        logger.info("OPTIMIZATION COMPLETE")
        logger.info("=" * 60)


# ═══════════════════════════════════════════════════════════════════════════════
#  CLI Interface
# ═══════════════════════════════════════════════════════════════════════════════


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(
        description="MongoDB Optimization Script for WinLux AI Apps",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python mongodb_optimize.py --check              Check collection sizes
  python mongodb_optimize.py --apply-ttl          Apply TTL indexes (dry run)
  python mongodb_optimize.py --apply-ttl --execute  Actually create TTL indexes
  python mongodb_optimize.py --archive            Archive old data (dry run)
  python mongodb_optimize.py --archive --execute  Actually archive data
  python mongodb_optimize.py --analyze            Analyze slow queries
  python mongodb_optimize.py --full               Run all optimizations (dry run)
  python mongodb_optimize.py --full --execute     Run all optimizations for real
  python mongodb_optimize.py --report             Generate report only

Scheduled Tasks (Windows):
  Daily:   python mongodb_optimize.py --check --report
  Weekly:  python mongodb_optimize.py --archive --execute
  Monthly: python mongodb_optimize.py --full --execute
        """,
    )

    parser.add_argument("--check", action="store_true", help="Check collection sizes")
    parser.add_argument(
        "--apply-ttl", action="store_true", help="Apply TTL indexes for auto-cleanup"
    )
    parser.add_argument(
        "--apply-indexes", action="store_true", help="Apply all defined indexes"
    )
    parser.add_argument(
        "--archive", action="store_true", help="Archive old data to separate collections"
    )
    parser.add_argument(
        "--analyze", action="store_true", help="Analyze slow queries"
    )
    parser.add_argument(
        "--unused-indexes", action="store_true", help="Find unused indexes"
    )
    parser.add_argument(
        "--full", action="store_true", help="Run all optimizations"
    )
    parser.add_argument(
        "--report", action="store_true", help="Generate optimization report"
    )
    parser.add_argument(
        "--execute",
        action="store_true",
        help="Actually execute changes (default is dry run)",
    )
    parser.add_argument(
        "--output", "-o", type=str, help="Output path for report JSON"
    )
    parser.add_argument(
        "--uri", type=str, default=MONGODB_URI, help="MongoDB connection URI"
    )

    args = parser.parse_args()

    # Default to check if no action specified
    if not any([
        args.check,
        args.apply_ttl,
        args.apply_indexes,
        args.archive,
        args.analyze,
        args.unused_indexes,
        args.full,
        args.report,
    ]):
        args.check = True
        args.report = True

    dry_run = not args.execute

    # Initialize optimizer
    optimizer = MongoDBOptimizer(uri=args.uri)

    # Run requested operations
    if args.full:
        optimizer.run_full_optimization(dry_run=dry_run)
    else:
        if args.check:
            optimizer.check_sizes()

        if args.apply_indexes:
            optimizer.apply_indexes(dry_run=dry_run)

        if args.apply_ttl:
            optimizer.apply_ttl_indexes(dry_run=dry_run)

        if args.archive:
            optimizer.archive_old_data(dry_run=dry_run)

        if args.analyze:
            optimizer.analyze_slow_queries()

        if args.unused_indexes:
            optimizer.find_unused_indexes()

        if args.report:
            output_path = args.output or f"mongodb_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
            optimizer.generate_report(output_path=output_path)


if __name__ == "__main__":
    main()
