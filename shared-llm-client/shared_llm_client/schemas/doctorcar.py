"""Doctor Car AI — Pydantic schemas for LiteAgent tasks."""

from pydantic import BaseModel, Field
from typing import List, Optional


class SymptomExtraction(BaseModel):
    """Extract structured information from Vietnamese car symptom description."""
    symptom_normalized: str = Field(description="Triệu chứng chuẩn hóa (tiếng Việt kỹ thuật)")
    body_system: str = Field(description="Hệ thống: động cơ, phanh, treo, điện, hộp số, làm mát, nhiên liệu, khác")
    severity_hint: str = Field(default="unknown", description="low, medium, high, critical")
    related_parts: List[str] = Field(default_factory=list, description="Bộ phận liên quan")
    when_occurs: str = Field(default="", description="Khi nào xảy ra: khởi động, phanh, tăng tốc, luôn luôn, thỉnh thoảng")
    confidence: float = Field(default=0.7)


class DiagnosisReasoning(BaseModel):
    """AI reasoning output for car diagnosis."""
    possible_causes: List[str] = Field(description="Top 3 nguyên nhân có thể (tiếng Việt)")
    most_likely: str = Field(description="Nguyên nhân khả năng cao nhất")
    confidence_pct: int = Field(description="Mức tin cậy 0-100%")
    severity: int = Field(description="Mức độ 1-5 (1=nhẹ, 5=nguy hiểm)")
    source_references: List[str] = Field(default_factory=list, description="TSB#, OEM ref, community")
    explanation_vi: str = Field(description="Giải thích dễ hiểu cho user")
    confidence: float = Field(default=0.7)


class CostEstimation(BaseModel):
    """Repair cost estimation for Vietnamese market."""
    part_name_vi: str = Field(description="Tên phụ tùng/dịch vụ tiếng Việt")
    oem_price_range: str = Field(description="Giá OEM: VD '800K-1.2M VND'")
    aftermarket_price_range: str = Field(description="Giá aftermarket: VD '400K-600K VND'")
    labor_cost_range: str = Field(description="Công sửa: VD '200K-400K VND'")
    region: str = Field(default="HCM", description="HN, HCM, Tỉnh")
    total_estimate: str = Field(description="Tổng ước tính: VD '600K-1.6M VND'")
    confidence: float = Field(default=0.7)


class SafetyAssessment(BaseModel):
    """Vehicle safety assessment output."""
    is_safe_to_drive: bool = Field(description="Có an toàn để lái không")
    severity: int = Field(description="1-5 severity level")
    immediate_action: str = Field(description="Hành động ngay: tiếp tục lái, lái chậm, dừng lại, gọi cứu hộ")
    warning_vi: str = Field(description="Cảnh báo cho user (tiếng Việt)")
    recall_related: bool = Field(default=False, description="Có liên quan recall không")
    confidence: float = Field(default=0.8)


class MaintenanceSchedule(BaseModel):
    """Proactive maintenance recommendation."""
    items: List[str] = Field(description="Danh sách bảo dưỡng cần làm")
    next_due_km: Optional[int] = Field(default=None, description="Km tiếp theo cần bảo dưỡng")
    next_due_date: Optional[str] = Field(default=None, description="Ngày tiếp theo (dd/MM/yyyy)")
    estimated_cost_total: str = Field(default="", description="Tổng chi phí ước tính")
    priority_item: str = Field(default="", description="Mục ưu tiên nhất")
    confidence: float = Field(default=0.7)
