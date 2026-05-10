"""FastAPI application for Product Linker service."""

import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI
from motor.motor_asyncio import AsyncIOMotorClient

from product_linker.config import settings
from product_linker.detector import MentionDetector
from product_linker.models import LinkRequest, LinkResponse

logger = logging.getLogger(__name__)

# Global detector instance
_detector: MentionDetector | None = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: connect to MongoDB on startup."""
    global _detector
    try:
        client = AsyncIOMotorClient(settings.mongodb_uri)
        db = client[settings.database_name]
        _detector = MentionDetector(db)
        logger.info(f"Connected to MongoDB: {settings.database_name}")
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        _detector = None
    yield
    # Cleanup
    if _detector:
        _detector = None


app = FastAPI(
    title="Product Linker",
    version="1.0.0",
    description="Detects product/brand/topic mentions and returns affiliate links",
    lifespan=lifespan,
)


@app.post("/api/link", response_model=LinkResponse)
async def detect_and_link(request: LinkRequest) -> LinkResponse:
    """Detect product/brand/topic mentions and return affiliate links.

    Returns empty mentions list if MongoDB is unreachable (non-critical service).
    """
    start_time = time.time()

    if _detector is None:
        return LinkResponse(mentions=[], processing_time_ms=0.0)

    try:
        mentions = await _detector.detect(request.text)
    except Exception as e:
        logger.error(f"Detection error: {e}")
        mentions = []

    processing_time_ms = (time.time() - start_time) * 1000

    return LinkResponse(
        mentions=mentions,
        processing_time_ms=round(processing_time_ms, 2),
    )


@app.get("/api/health")
async def health():
    """Health check endpoint."""
    return {
        "status": "healthy" if _detector else "degraded",
        "service": "product-linker",
        "port": settings.port,
    }


@app.get("/api/catalog/stats")
async def catalog_stats():
    """Return catalog size and last update time."""
    if _detector is None:
        return {"error": "MongoDB not connected", "total_entries": 0}

    try:
        stats = await _detector.get_catalog_stats()
        return stats
    except Exception as e:
        logger.error(f"Catalog stats error: {e}")
        return {"error": str(e), "total_entries": 0}
