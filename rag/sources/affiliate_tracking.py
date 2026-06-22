"""
Resource Expansion Phase 4 — Affiliate Tracking Source.

Unified affiliate tracking across all product sources:
- Click tracking (SmartBuy → Shopee/Lazada/Tiki/Amazon/iHerb)
- Conversion attribution (30-day cookie window)
- Revenue aggregation per source/product/campaign
- Commission rate monitoring and optimization

Usage:
    from shared_libs.rag.sources.affiliate_tracking import AffiliateTrackingSource

    tracker = AffiliateTrackingSource()
    tracker.record_click(product_id="abc", source="shopee", user_id="user_123")
    tracker.record_conversion(click_id="click_xyz", order_amount=500000)
    report = tracker.get_revenue_report(days=30)
"""

import logging
import os
import uuid
from datetime import datetime, timezone, timedelta
from typing import Optional

from pymongo import MongoClient

logger = logging.getLogger("rag.sources.affiliate_tracking")

MONGODB_URI = os.environ.get("MONGODB_URI", "mongodb://localhost:27017")

# Affiliate program configurations
AFFILIATE_PROGRAMS = {
    "shopee": {
        "name": "Shopee Affiliate",
        "commission_rate": 0.04,  # 4% default
        "cookie_days": 30,
        "tracking_param": "af_id",
        "base_url": "https://shope.ee",
    },
    "lazada": {
        "name": "Lazada Affiliate",
        "commission_rate": 0.05,  # 5% default
        "cookie_days": 7,
        "tracking_param": "aff_id",
        "base_url": "https://www.lazada.vn",
    },
    "tiki": {
        "name": "Tiki Affiliate",
        "commission_rate": 0.03,  # 3% default
        "cookie_days": 14,
        "tracking_param": "ref",
        "base_url": "https://tiki.vn",
    },
    "amazon": {
        "name": "Amazon Associates",
        "commission_rate": 0.03,
        "cookie_days": 1,  # Amazon's 24-hour cookie
        "tracking_param": "tag",
        "base_url": "https://www.amazon.com",
    },
    "iherb": {
        "name": "iHerb Rewards",
        "commission_rate": 0.05,
        "cookie_days": 30,
        "tracking_param": "rcode",
        "base_url": "https://www.iherb.com",
    },
    "dienmayxanh": {
        "name": "Điện Máy Xanh Affiliate",
        "commission_rate": 0.03,
        "cookie_days": 30,
        "tracking_param": "aff",
        "base_url": "https://www.dienmayxanh.com",
    },
    "phongvu": {
        "name": "Phong Vũ Affiliate",
        "commission_rate": 0.025,
        "cookie_days": 14,
        "tracking_param": "ref",
        "base_url": "https://phongvu.vn",
    },
}


class AffiliateTrackingSource:
    """
    Unified affiliate click and conversion tracking.

    Tracks the full funnel:
    1. Click: User clicks affiliate link from SmartBuy
    2. Attribution: Cookie-based attribution window
    3. Conversion: Purchase confirmed by affiliate network
    4. Commission: Revenue recorded and aggregated

    Collections:
    - affiliate_clicks: Individual click events
    - affiliate_conversions: Confirmed purchases
    - affiliate_revenue: Aggregated revenue metrics
    """

    def __init__(self, mongo_uri: str = MONGODB_URI, db_name: str = "smartbuy"):
        self._client = MongoClient(mongo_uri)
        self._db = self._client[db_name]

        # Ensure indexes
        self._db.affiliate_clicks.create_index([("click_id", 1)], unique=True)
        self._db.affiliate_clicks.create_index([("user_id", 1), ("created_at", -1)])
        self._db.affiliate_clicks.create_index([("product_id", 1)])
        self._db.affiliate_clicks.create_index([("source", 1), ("created_at", -1)])
        self._db.affiliate_conversions.create_index([("click_id", 1)])
        self._db.affiliate_conversions.create_index([("source", 1), ("converted_at", -1)])

    def record_click(
        self,
        product_id: str,
        source: str,
        user_id: Optional[str] = None,
        campaign: Optional[str] = None,
        referrer_url: Optional[str] = None,
        ip_address: Optional[str] = None,
    ) -> str:
        """
        Record an affiliate link click.

        Args:
            product_id: Internal product identifier.
            source: Affiliate program (shopee, lazada, amazon, etc.).
            user_id: Optional user identifier (for logged-in users).
            campaign: Optional campaign identifier.
            referrer_url: Page where the click originated.
            ip_address: User's IP (for anonymous attribution).

        Returns:
            click_id for conversion attribution.
        """
        click_id = str(uuid.uuid4())
        program = AFFILIATE_PROGRAMS.get(source, {})

        click_doc = {
            "click_id": click_id,
            "product_id": product_id,
            "source": source,
            "program_name": program.get("name", source),
            "user_id": user_id,
            "campaign": campaign or "organic",
            "referrer_url": referrer_url,
            "ip_address": ip_address,
            "cookie_expires_at": datetime.now(timezone.utc) + timedelta(
                days=program.get("cookie_days", 30)
            ),
            "converted": False,
            "created_at": datetime.now(timezone.utc),
        }

        self._db.affiliate_clicks.insert_one(click_doc)

        logger.debug(f"Recorded click: {click_id} → {source}/{product_id}")
        return click_id

    def record_conversion(
        self,
        click_id: str,
        order_amount: float,
        order_id: Optional[str] = None,
        currency: str = "VND",
        commission_override: Optional[float] = None,
    ) -> Optional[dict]:
        """
        Record a confirmed conversion (purchase).

        Args:
            click_id: The click that led to this conversion.
            order_amount: Total order amount.
            order_id: External order ID from affiliate network.
            currency: Currency code (default: VND).
            commission_override: Override commission rate if different from default.

        Returns:
            Conversion record dict, or None if click not found.
        """
        # Find the original click
        click = self._db.affiliate_clicks.find_one({"click_id": click_id})
        if not click:
            logger.warning(f"Click not found for conversion: {click_id}")
            return None

        # Check if cookie is still valid
        if click.get("cookie_expires_at") and click["cookie_expires_at"] < datetime.now(timezone.utc):
            logger.info(f"Click {click_id} cookie expired — conversion not attributed")
            return None

        # Calculate commission
        source = click.get("source", "")
        program = AFFILIATE_PROGRAMS.get(source, {})
        commission_rate = commission_override or program.get("commission_rate", 0.03)
        commission_amount = order_amount * commission_rate

        conversion_doc = {
            "conversion_id": str(uuid.uuid4()),
            "click_id": click_id,
            "product_id": click.get("product_id"),
            "source": source,
            "user_id": click.get("user_id"),
            "campaign": click.get("campaign"),
            "order_id": order_id,
            "order_amount": order_amount,
            "commission_rate": commission_rate,
            "commission_amount": commission_amount,
            "currency": currency,
            "converted_at": datetime.now(timezone.utc),
            "click_to_conversion_hours": (
                (datetime.now(timezone.utc) - click["created_at"]).total_seconds() / 3600
            ),
        }

        self._db.affiliate_conversions.insert_one(conversion_doc)

        # Mark click as converted
        self._db.affiliate_clicks.update_one(
            {"click_id": click_id},
            {"$set": {"converted": True, "converted_at": datetime.now(timezone.utc)}},
        )

        logger.info(
            f"Conversion recorded: {source} order {order_amount:,.0f} {currency} "
            f"→ commission {commission_amount:,.0f} {currency}"
        )

        return conversion_doc

    def get_revenue_report(self, days: int = 30) -> dict:
        """
        Generate revenue report aggregated by source.

        Args:
            days: Number of days to look back.

        Returns:
            Dict with per-source revenue breakdown and totals.
        """
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        pipeline = [
            {"$match": {"converted_at": {"$gte": cutoff}}},
            {
                "$group": {
                    "_id": "$source",
                    "total_conversions": {"$sum": 1},
                    "total_order_amount": {"$sum": "$order_amount"},
                    "total_commission": {"$sum": "$commission_amount"},
                    "avg_order_amount": {"$avg": "$order_amount"},
                    "avg_commission_rate": {"$avg": "$commission_rate"},
                }
            },
            {"$sort": {"total_commission": -1}},
        ]

        results = list(self._db.affiliate_conversions.aggregate(pipeline))

        # Click stats for conversion rate
        click_pipeline = [
            {"$match": {"created_at": {"$gte": cutoff}}},
            {"$group": {"_id": "$source", "total_clicks": {"$sum": 1}}},
        ]
        click_stats = {
            r["_id"]: r["total_clicks"]
            for r in self._db.affiliate_clicks.aggregate(click_pipeline)
        }

        sources = []
        total_commission = 0
        total_clicks = 0
        total_conversions = 0

        for r in results:
            source = r["_id"]
            clicks = click_stats.get(source, 0)
            conversions = r["total_conversions"]
            commission = r["total_commission"]

            sources.append({
                "source": source,
                "program_name": AFFILIATE_PROGRAMS.get(source, {}).get("name", source),
                "clicks": clicks,
                "conversions": conversions,
                "conversion_rate_pct": round(conversions / max(clicks, 1) * 100, 2),
                "total_order_amount": r["total_order_amount"],
                "total_commission": commission,
                "avg_order_amount": round(r["avg_order_amount"], 0),
                "avg_commission_rate": round(r["avg_commission_rate"] * 100, 2),
            })

            total_commission += commission
            total_clicks += clicks
            total_conversions += conversions

        return {
            "period_days": days,
            "total_clicks": total_clicks,
            "total_conversions": total_conversions,
            "overall_conversion_rate_pct": round(
                total_conversions / max(total_clicks, 1) * 100, 2
            ),
            "total_commission": total_commission,
            "currency": "VND",
            "sources": sources,
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    def get_top_products(self, days: int = 30, limit: int = 20) -> list[dict]:
        """Get top-performing products by affiliate revenue."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)

        pipeline = [
            {"$match": {"converted_at": {"$gte": cutoff}}},
            {
                "$group": {
                    "_id": "$product_id",
                    "conversions": {"$sum": 1},
                    "total_commission": {"$sum": "$commission_amount"},
                    "total_order_amount": {"$sum": "$order_amount"},
                }
            },
            {"$sort": {"total_commission": -1}},
            {"$limit": limit},
        ]

        return list(self._db.affiliate_conversions.aggregate(pipeline))

    def close(self):
        self._client.close()
