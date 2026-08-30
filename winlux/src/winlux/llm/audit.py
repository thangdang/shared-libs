"""AI audit trail — immutable logging of AI decisions for compliance.

Logs all significant AI decisions (classification, diagnosis, content approval)
with source tracing, model version, and confidence scores.

NEVER stores full prompts — only hashes + summaries for privacy.

Usage:
    audit = AuditLogger(product="caremate", db=mongo_db)
    await audit.log_decision(
        run_id="abc123",
        decision_type="severity_classification",
        value="high",
        reasoning="Patient reported chest pain + shortness of breath",
        model="qwen3:8b",
        confidence=0.92,
        sources=["symptom_db", "medical_guidelines"]
    )
"""

import hashlib
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# TTL policies per product (seconds)
RETENTION_POLICIES = {
    "caremate": 7 * 365 * 86400,    # 7 years (health data)
    "fintax": 7 * 365 * 86400,      # 7 years (financial/tax data)
    "doctorcar": 2 * 365 * 86400,   # 2 years (vehicle diagnostics)
    "childhood": 90 * 86400,         # 90 days (content decisions)
    "smartbuy": 90 * 86400,          # 90 days (product recommendations)
    "trendbriefai": 90 * 86400,      # 90 days (article decisions)
}


class AuditLogger:
    """Immutable audit logger for AI decisions.

    Stores in MongoDB collection `ai_audit_trail` within product's database.
    """

    def __init__(self, product: str, db=None):
        """Initialize audit logger.

        Args:
            product: Product name (determines retention policy).
            db: MongoDB database instance (pymongo or motor).
        """
        self.product = product.lower()
        self._db = db
        self._collection_name = "ai_audit_trail"
        self._retention_seconds = RETENTION_POLICIES.get(self.product, 90 * 86400)

    async def log_decision(
        self,
        run_id: str,
        decision_type: str,
        value: Any,
        reasoning: str,
        model: str,
        confidence: float = 0.0,
        sources: Optional[List[str]] = None,
        metadata: Optional[Dict] = None,
    ) -> Optional[str]:
        """Log an AI decision to the audit trail.

        Args:
            run_id: Pipeline/session run ID.
            decision_type: Type of decision (e.g., "severity_classification", "content_approval").
            value: The decision value (e.g., "high", "approved", "blocked").
            reasoning: Brief explanation (NOT full prompt — summarized).
            model: Model used for this decision.
            confidence: Confidence score 0.0-1.0.
            sources: Data sources consulted.
            metadata: Additional context (non-sensitive).

        Returns:
            Audit entry ID (or None if DB unavailable).
        """
        entry = {
            "product": self.product,
            "run_id": run_id,
            "decision_type": decision_type,
            "value": value,
            "reasoning": reasoning[:500],  # Cap reasoning length
            "reasoning_hash": self._hash_text(reasoning),
            "model": model,
            "confidence": confidence,
            "sources": sources or [],
            "metadata": metadata or {},
            "timestamp": datetime.now(timezone.utc),
            "ttl_expires_at": datetime.now(timezone.utc),  # MongoDB TTL index handles expiry
        }

        if self._db is not None:
            try:
                collection = self._db[self._collection_name]
                result = await self._insert(collection, entry)
                return str(result)
            except Exception as e:
                logger.error(f"Failed to log audit entry: {e}")
                return None
        else:
            # No DB — log to stdout for development
            logger.info(
                f"AUDIT [{self.product}] {decision_type}={value} "
                f"confidence={confidence:.2f} model={model} run={run_id}"
            )
            return None

    async def log_security_event(
        self,
        event_type: str,
        details: str,
        source: str,
        severity: str = "medium",
    ) -> None:
        """Log a security event (injection attempt, unauthorized access, etc.)

        Args:
            event_type: "injection_detected", "cross_access_attempt", "pii_external_call"
            details: What happened (redacted).
            source: Where it came from.
            severity: "low", "medium", "high", "critical"
        """
        entry = {
            "product": self.product,
            "event_type": f"security_{event_type}",
            "details": details[:200],
            "source": source,
            "severity": severity,
            "timestamp": datetime.now(timezone.utc),
        }

        if self._db is not None:
            try:
                collection = self._db[self._collection_name]
                await self._insert(collection, entry)
            except Exception as e:
                logger.error(f"Failed to log security event: {e}")

        logger.warning(
            f"SECURITY [{self.product}] {event_type}: {details[:100]} "
            f"(severity={severity}, source={source})"
        )

    async def query(
        self,
        decision_type: Optional[str] = None,
        days: int = 7,
        limit: int = 100,
    ) -> List[Dict]:
        """Query audit trail.

        Args:
            decision_type: Filter by decision type.
            days: Look back N days.
            limit: Max results.

        Returns:
            List of audit entries.
        """
        if self._db is None:
            return []

        from datetime import timedelta
        since = datetime.now(timezone.utc) - timedelta(days=days)

        query_filter: Dict = {
            "product": self.product,
            "timestamp": {"$gte": since},
        }
        if decision_type:
            query_filter["decision_type"] = decision_type

        try:
            collection = self._db[self._collection_name]
            cursor = collection.find(query_filter).sort("timestamp", -1).limit(limit)
            return await cursor.to_list(length=limit)
        except Exception as e:
            logger.error(f"Audit query failed: {e}")
            return []

    async def get_stats(self, days: int = 7) -> Dict:
        """Get audit statistics for this product.

        Returns:
            Dict with counts per decision_type, avg confidence, model distribution.
        """
        entries = await self.query(days=days, limit=1000)

        if not entries:
            return {"total": 0, "by_type": {}, "avg_confidence": 0.0, "by_model": {}}

        by_type: Dict[str, int] = {}
        by_model: Dict[str, int] = {}
        total_confidence = 0.0
        confidence_count = 0

        for entry in entries:
            dt = entry.get("decision_type", "unknown")
            by_type[dt] = by_type.get(dt, 0) + 1

            model = entry.get("model", "unknown")
            by_model[model] = by_model.get(model, 0) + 1

            conf = entry.get("confidence", 0)
            if conf > 0:
                total_confidence += conf
                confidence_count += 1

        return {
            "total": len(entries),
            "by_type": by_type,
            "avg_confidence": total_confidence / max(confidence_count, 1),
            "by_model": by_model,
        }

    async def _insert(self, collection, entry: Dict):
        """Insert entry (handles both sync and async motor)."""
        if hasattr(collection, 'insert_one'):
            # Try async first (motor)
            result = collection.insert_one(entry)
            if hasattr(result, '__await__'):
                result = await result
            return result.inserted_id
        return None

    @staticmethod
    def _hash_text(text: str) -> str:
        """Hash text for audit trail (never store full prompts)."""
        return hashlib.sha256(text.encode()).hexdigest()[:16]
