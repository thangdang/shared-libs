"""Pydantic models for Product Linker API."""

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class LinkRequest(BaseModel):
    """Request body for the /api/link endpoint."""

    text: str = Field(..., description="Text to scan for product/topic mentions")
    source_engine: Optional[str] = Field(
        None, description="Which AI engine is calling (for logging)"
    )


class DetectedMention(BaseModel):
    """A detected product/brand/topic mention with affiliate link."""

    text: str = Field(..., description="Matched text in input")
    type: str = Field(..., description="Category: product, brand, health, finance")
    affiliate_url: str = Field(..., description="Affiliate tracking URL")
    platform: str = Field(..., description="Platform: shopee, lazada, caremate, fintax")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Match confidence")


class LinkResponse(BaseModel):
    """Response from the /api/link endpoint."""

    mentions: List[DetectedMention] = Field(default_factory=list)
    processing_time_ms: float = Field(..., description="Processing time in milliseconds")


class CatalogEntry(BaseModel):
    """MongoDB affiliate catalog entry."""

    product_name: str
    brand: str
    affiliate_url: str
    platform: str
    category: str
    topic_keywords: List[str] = Field(default_factory=list)
    match_type: str = "keyword"  # "exact", "fuzzy", "keyword"
    enabled: bool = True
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None


class CatalogStats(BaseModel):
    """Catalog statistics response."""

    total_entries: int
    enabled_entries: int
    last_refresh: Optional[datetime] = None
    categories: dict = Field(default_factory=dict)
