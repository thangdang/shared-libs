"""SmartBuy AI — Pydantic schemas for LiteAgent tasks."""

from pydantic import BaseModel, Field
from typing import List, Optional


class QueryIntent(BaseModel):
    """Classify user shopping query intent."""
    intent: str = Field(description="search, compare, recommend, alert, question")
    product_category: str = Field(default="", description="Danh mục sản phẩm")
    brand: Optional[str] = Field(default=None, description="Thương hiệu nếu nhắc")
    price_range: Optional[str] = Field(default=None, description="Khoảng giá (VND)")
    urgency: str = Field(default="normal", description="normal, flash_sale, urgent")
    confidence: float = Field(default=0.8)


class ProductComparison(BaseModel):
    """Generate product comparison text."""
    summary_vi: str = Field(description="Tóm tắt so sánh bằng tiếng Việt")
    winner: Optional[str] = Field(default=None, description="Sản phẩm nổi bật nhất")
    key_differences: List[str] = Field(default_factory=list, description="Điểm khác biệt chính")
    recommendation_vi: str = Field(default="", description="Gợi ý mua")
    confidence: float = Field(default=0.7)


class Recommendation(BaseModel):
    """Product recommendation output."""
    products: List[str] = Field(description="Tên sản phẩm gợi ý (max 5)")
    reasoning_vi: str = Field(description="Lý do gợi ý bằng tiếng Việt")
    price_tier: str = Field(default="mid", description="budget, mid, premium")
    best_for: str = Field(default="", description="Phù hợp nhất cho ai/nhu cầu gì")
    confidence: float = Field(default=0.7)


class ReviewSummary(BaseModel):
    """Summarize product reviews."""
    overall_sentiment: str = Field(description="positive, mixed, negative")
    pros_vi: List[str] = Field(default_factory=list, description="Ưu điểm (tiếng Việt)")
    cons_vi: List[str] = Field(default_factory=list, description="Nhược điểm (tiếng Việt)")
    common_issues: List[str] = Field(default_factory=list, description="Vấn đề hay gặp")
    rating_estimate: float = Field(default=0, description="Ước tính rating 1-5")
    confidence: float = Field(default=0.7)
