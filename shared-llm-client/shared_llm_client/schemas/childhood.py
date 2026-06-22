"""Childhood (AI Video Engine) — Pydantic schemas for LiteAgent tasks."""

from pydantic import BaseModel, Field
from typing import List, Optional


class HookScore(BaseModel):
    """Score a script hook for engagement potential."""
    score: int = Field(description="0-100 hook effectiveness score")
    hook_type: str = Field(description="question, statement, nostalgia, shock, list")
    strengths: List[str] = Field(default_factory=list, description="Điểm mạnh của hook")
    weaknesses: List[str] = Field(default_factory=list, description="Điểm yếu cần cải thiện")
    suggestion_vi: str = Field(default="", description="Gợi ý cải thiện")
    confidence: float = Field(default=0.7)


class TopicSelection(BaseModel):
    """Select and score topics for content production."""
    selected_topic: str = Field(description="Topic chọn để sản xuất")
    score: int = Field(description="0-100 content potential")
    reasoning_vi: str = Field(description="Lý do chọn (tiếng Việt)")
    angle: str = Field(default="", description="Góc khai thác đề xuất")
    estimated_views: str = Field(default="unknown", description="Ước tính views: low/medium/high")
    related_topics: List[str] = Field(default_factory=list, description="Topics liên quan")
    confidence: float = Field(default=0.7)


class SEOOutput(BaseModel):
    """Generate SEO metadata for video."""
    title_vi: str = Field(description="Tiêu đề video (tiếng Việt, ≤60 ký tự)")
    description_vi: str = Field(description="Mô tả video (≤200 ký tự)")
    tags: List[str] = Field(description="Tags/hashtags (10-15)")
    thumbnail_text: str = Field(default="", description="Text gợi ý cho thumbnail")
    confidence: float = Field(default=0.8)


class ChannelStrategy(BaseModel):
    """Channel strategy analysis output."""
    current_state: str = Field(description="growing, stable, declining, new")
    top_performing_topics: List[str] = Field(default_factory=list)
    avoid_topics: List[str] = Field(default_factory=list)
    recommended_hook_types: List[str] = Field(default_factory=list)
    posting_frequency: str = Field(default="daily", description="Tần suất đề xuất")
    strategic_notes_vi: str = Field(default="", description="Ghi chú chiến lược")
    confidence: float = Field(default=0.7)


class ContentDecision(BaseModel):
    """Decide whether to produce content for a trend."""
    decision: str = Field(description="produce, skip, defer")
    reason_vi: str = Field(description="Lý do quyết định")
    priority: int = Field(default=5, description="1-10 priority (10=highest)")
    best_time_to_publish: Optional[str] = Field(default=None, description="Thời điểm đăng tốt nhất")
    confidence: float = Field(default=0.7)
