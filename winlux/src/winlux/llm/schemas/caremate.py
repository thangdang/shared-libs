"""CareMate AI — Pydantic schemas for LiteAgent tasks."""

from pydantic import BaseModel, Field
from typing import List, Optional


class SymptomClassification(BaseModel):
    """Classify user symptoms into body system and urgency."""
    body_system: str = Field(description="Hệ cơ quan: hô hấp, tiêu hóa, thần kinh, tim mạch, cơ xương, da liễu, tiết niệu, khác")
    primary_symptom: str = Field(description="Triệu chứng chính bằng tiếng Việt")
    related_symptoms: List[str] = Field(default_factory=list, description="Triệu chứng phụ")
    duration_category: str = Field(default="unknown", description="Thời gian: acute (<24h), subacute (1-7d), chronic (>7d)")
    confidence: float = Field(default=0.7, description="Confidence 0.0-1.0")


class SeverityScore(BaseModel):
    """Score symptom severity for triage."""
    level: str = Field(description="low, medium, high, emergency")
    score: int = Field(description="1-10 severity score")
    reasoning: str = Field(description="Brief reason in Vietnamese")
    needs_doctor: bool = Field(default=False, description="Whether user should see a doctor")
    emergency: bool = Field(default=False, description="Whether this is an emergency (call 115)")
    confidence: float = Field(default=0.7)


class DrugCheck(BaseModel):
    """Check drug information or interaction."""
    drug_name_vi: str = Field(description="Tên thuốc tiếng Việt")
    active_ingredient: str = Field(default="", description="Hoạt chất")
    usage: str = Field(description="Công dụng chính")
    common_side_effects: List[str] = Field(default_factory=list, description="Tác dụng phụ thường gặp")
    interactions_warning: Optional[str] = Field(default=None, description="Cảnh báo tương tác nếu có")
    confidence: float = Field(default=0.7)


class HealthResponse(BaseModel):
    """Generated health response to user question."""
    response_vi: str = Field(description="Câu trả lời bằng tiếng Việt")
    sources: List[str] = Field(default_factory=list, description="Nguồn tham khảo")
    severity_flag: str = Field(default="normal", description="normal, warning, urgent")
    follow_up_questions: List[str] = Field(default_factory=list, description="Câu hỏi follow-up gợi ý")
    confidence: float = Field(default=0.7)
