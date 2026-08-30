"""TrendBrief AI — Pydantic schemas for LiteAgent tasks."""

from pydantic import BaseModel, Field
from typing import List, Optional


class ArticleCategory(BaseModel):
    """Classify article into categories."""
    primary_category: str = Field(description="Danh mục chính: công nghệ, kinh doanh, xã hội, giải trí, khoa học, thể thao, sức khỏe")
    sub_category: Optional[str] = Field(default=None, description="Danh mục phụ")
    tags: List[str] = Field(default_factory=list, description="Tags (max 5)")
    language: str = Field(default="vi", description="Ngôn ngữ: vi, en, mixed")
    confidence: float = Field(default=0.8)


class TrendScore(BaseModel):
    """Score a trending topic for content potential."""
    score: int = Field(description="0-100 content potential score")
    virality: str = Field(default="medium", description="low, medium, high")
    competition: str = Field(default="medium", description="low, medium, high")
    timeliness: str = Field(default="current", description="breaking, current, evergreen, fading")
    target_audience: str = Field(default="general", description="Đối tượng phù hợp")
    confidence: float = Field(default=0.7)


class SummaryOutput(BaseModel):
    """AI-generated article summary."""
    title_vi: str = Field(description="Tiêu đề tiếng Việt (ngắn gọn, hấp dẫn)")
    bullets: List[str] = Field(description="3-5 bullet points tóm tắt")
    key_takeaway: str = Field(description="Điểm chính cần nhớ (1 câu)")
    sentiment: str = Field(default="neutral", description="positive, negative, neutral")
    word_count: int = Field(default=0, description="Số từ bài gốc")
    confidence: float = Field(default=0.8)


class HeadlineGeneration(BaseModel):
    """Generate Vietnamese headline options."""
    headlines: List[str] = Field(description="3-5 tiêu đề gợi ý (tiếng Việt)")
    best_pick: int = Field(default=0, description="Index of best headline (0-based)")
    style: str = Field(default="informative", description="informative, clickbait, question, listicle")
    confidence: float = Field(default=0.7)
