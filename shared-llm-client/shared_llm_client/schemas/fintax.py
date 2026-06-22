"""FIN Tax AI — Pydantic schemas for LiteAgent tasks."""

from pydantic import BaseModel, Field
from typing import List, Optional


class IncomeClassification(BaseModel):
    """Classify income source into Vietnamese tax categories."""
    category: str = Field(description="Loại thu nhập: lương, kinh doanh, đầu tư, cho thuê, chuyển nhượng, khác")
    sub_category: Optional[str] = Field(default=None, description="Phân loại phụ nếu có")
    tax_type: str = Field(description="Loại thuế: TNCN lũy tiến, TNCN 10%, miễn thuế")
    applicable_bracket: Optional[str] = Field(default=None, description="Bậc thuế áp dụng nếu lũy tiến")
    deductible: bool = Field(default=False, description="Có được giảm trừ không")
    confidence: float = Field(default=0.8)


class DeductionValidation(BaseModel):
    """Validate if an expense qualifies for tax deduction."""
    qualifies: bool = Field(description="Có được khấu trừ không")
    category: str = Field(description="Loại khấu trừ: bản thân, người phụ thuộc, bảo hiểm, từ thiện, khác")
    max_amount_vnd: Optional[int] = Field(default=None, description="Mức tối đa (VND) nếu có")
    regulation_ref: str = Field(default="", description="Tham chiếu quy định (số thông tư/nghị định)")
    notes_vi: str = Field(default="", description="Ghi chú bằng tiếng Việt")
    confidence: float = Field(default=0.8)


class TaxExplanation(BaseModel):
    """Generated tax explanation for user question."""
    answer_vi: str = Field(description="Câu trả lời bằng tiếng Việt")
    applicable_law: str = Field(default="", description="Luật/thông tư áp dụng")
    examples: List[str] = Field(default_factory=list, description="Ví dụ minh họa")
    warnings: List[str] = Field(default_factory=list, description="Lưu ý quan trọng")
    confidence: float = Field(default=0.7)


class SellerFeeAnalysis(BaseModel):
    """Analyze Shopee/Lazada seller fees."""
    platform: str = Field(description="shopee, lazada, tiktok")
    total_fees_vnd: int = Field(description="Tổng phí (VND)")
    fee_breakdown: List[str] = Field(default_factory=list, description="Chi tiết từng loại phí")
    anomaly_detected: bool = Field(default=False, description="Có bất thường không")
    anomaly_description: Optional[str] = Field(default=None)
    confidence: float = Field(default=0.8)
