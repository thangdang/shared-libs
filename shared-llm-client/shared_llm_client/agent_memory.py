"""Agent memory — persistent lessons learned across sessions.

Stores per-agent, per-context memories (lessons, constraints, preferences)
that persist across pipeline runs.  Product-scoped with TTL.

Usage:
    memory = AgentMemory(product="childhood", db=mongo_db)
    await memory.store(
        agent="script_writer",
        context_id="channel_abc",
        type="lesson",
        content="Hook questions perform 2x better than statements for this channel",
        confidence=0.85,
    )
    memories = await memory.get(agent="script_writer", context_id="channel_abc", limit=5)
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)

# TTL per product (days)
MEMORY_TTL_DAYS = {
    "childhood": 90,
    "caremate": 365,
    "fintax": 180,
    "smartbuy": 90,
    "trendbriefai": 90,
    "doctorcar": 180,
}

# Max memories per agent per context
MAX_MEMORIES_PER_CONTEXT = 100

# Memory types
MEMORY_TYPES = ["lesson", "constraint", "preference", "failure", "success"]


class AgentMemory:
    """Persistent agent memory — lessons learned from past executions.

    Stored in MongoDB `agent_memories` collection within product's database.
    Scoped per product → agent → context_id.
    """

    def __init__(self, product: str, db):
        """Initialize.

        Args:
            product: Product name.
            db: MongoDB database instance.
        """
        self.product = product.lower()
        self._db = db
        self._collection = db.agent_memories
        self._ttl_days = MEMORY_TTL_DAYS.get(self.product, 90)

    async def store(
        self,
        agent: str,
        context_id: str,
        memory_type: str,
        content: str,
        confidence: float = 0.7,
        metadata: Optional[Dict] = None,
    ) -> bool:
        """Store a memory for an agent.

        Args:
            agent: Agent name (e.g., "script_writer", "trend_researcher").
            context_id: Context scope (e.g., channel_id, niche_id).
            memory_type: Type — "lesson", "constraint", "preference", "failure", "success".
            content: The memory content (natural language).
            confidence: Confidence score 0.0-1.0.
            metadata: Additional context (e.g., source_video_id, metric_value).

        Returns:
            True if stored successfully.
        """
        if memory_type not in MEMORY_TYPES:
            logger.warning(f"[AgentMemory] Invalid type: {memory_type}")
            return False

        try:
            # Check cap
            count = self._collection.count_documents({
                "product": self.product,
                "agent": agent,
                "context_id": context_id,
            })

            if count >= MAX_MEMORIES_PER_CONTEXT:
                # Remove oldest low-confidence memory
                oldest = self._collection.find_one(
                    {
                        "product": self.product,
                        "agent": agent,
                        "context_id": context_id,
                    },
                    sort=[("confidence", 1), ("created_at", 1)],
                )
                if oldest:
                    self._collection.delete_one({"_id": oldest["_id"]})

            # Insert
            self._collection.insert_one({
                "product": self.product,
                "agent": agent,
                "context_id": context_id,
                "type": memory_type,
                "content": content[:500],  # Cap content length
                "confidence": confidence,
                "metadata": metadata or {},
                "created_at": datetime.now(timezone.utc),
                "expires_at": datetime.now(timezone.utc) + timedelta(days=self._ttl_days),
            })

            logger.debug(
                f"[AgentMemory] Stored {memory_type} for {agent}/{context_id}: "
                f"{content[:60]}..."
            )
            return True

        except Exception as e:
            logger.error(f"[AgentMemory] Store failed: {e}")
            return False

    async def get(
        self,
        agent: str,
        context_id: str,
        limit: int = 5,
        memory_type: Optional[str] = None,
    ) -> List[Dict]:
        """Retrieve memories for an agent+context.

        Sorted by confidence × recency (highest first).

        Args:
            agent: Agent name.
            context_id: Context scope.
            limit: Max memories to return.
            memory_type: Optional filter by type.

        Returns:
            List of memory dicts.
        """
        try:
            query = {
                "product": self.product,
                "agent": agent,
                "context_id": context_id,
                "expires_at": {"$gt": datetime.now(timezone.utc)},
            }
            if memory_type:
                query["type"] = memory_type

            memories = list(
                self._collection.find(query, {"_id": 0, "product": 0})
                .sort([("confidence", -1), ("created_at", -1)])
                .limit(limit)
            )

            # Serialize dates
            for m in memories:
                if "created_at" in m:
                    m["created_at"] = m["created_at"].isoformat()
                if "expires_at" in m:
                    del m["expires_at"]

            return memories

        except Exception as e:
            logger.warning(f"[AgentMemory] Get failed: {e}")
            return []

    def format_for_prompt(self, memories: List[Dict]) -> str:
        """Format memories into a prompt section for agent backstory injection.

        Args:
            memories: List from get().

        Returns:
            Formatted string for prompt injection.
        """
        if not memories:
            return ""

        lines = ["=== BÀI HỌC TỪ TRƯỚC (Agent Memory) ==="]
        for m in memories:
            type_emoji = {
                "lesson": "📝",
                "constraint": "⚠️",
                "preference": "👍",
                "failure": "❌",
                "success": "✅",
            }.get(m.get("type", ""), "•")

            confidence = m.get("confidence", 0)
            content = m.get("content", "")
            lines.append(f"  {type_emoji} [{confidence:.0%}] {content}")

        return "\n".join(lines)

    async def cleanup_expired(self) -> int:
        """Remove expired memories.

        Returns:
            Number of memories removed.
        """
        try:
            result = self._collection.delete_many({
                "product": self.product,
                "expires_at": {"$lt": datetime.now(timezone.utc)},
            })
            if result.deleted_count > 0:
                logger.info(
                    f"[AgentMemory] Cleaned {result.deleted_count} expired memories "
                    f"for {self.product}"
                )
            return result.deleted_count
        except Exception as e:
            logger.warning(f"[AgentMemory] Cleanup failed: {e}")
            return 0

    async def get_stats(self) -> Dict:
        """Get memory statistics for this product."""
        try:
            pipeline = [
                {"$match": {"product": self.product}},
                {
                    "$group": {
                        "_id": {"agent": "$agent", "type": "$type"},
                        "count": {"$sum": 1},
                        "avg_confidence": {"$avg": "$confidence"},
                    }
                },
            ]
            results = list(self._collection.aggregate(pipeline))

            stats = {}
            for r in results:
                agent = r["_id"]["agent"]
                if agent not in stats:
                    stats[agent] = {}
                stats[agent][r["_id"]["type"]] = {
                    "count": r["count"],
                    "avg_confidence": round(r["avg_confidence"], 2),
                }

            total = sum(
                r["count"] for r in results
            )

            return {
                "product": self.product,
                "total_memories": total,
                "by_agent": stats,
            }
        except Exception as e:
            return {"product": self.product, "error": str(e)}
