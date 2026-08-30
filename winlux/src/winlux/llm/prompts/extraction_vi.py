"""Vietnamese data extraction prompt template.

Optimized for qwen2.5:7b. Designed for extracting structured data
from unstructured Vietnamese text: symptoms, entities, key facts,
financial data, car diagnostic codes.

Key patterns:
- Schema-driven extraction
- Vietnamese medical/financial/automotive vocabulary
- Handling of slang and abbreviations
"""

import json
from typing import Dict, List, Optional


class ExtractionTemplate:
    """Build extraction prompts for Vietnamese text.

    Optimized for:
    - Symptom extraction (CareMate)
    - Car symptom extraction (Doctor Car)
    - Financial data extraction (FinTax: receipts, invoices)
    - Entity extraction (names, organizations, amounts)
    - Keyword extraction (TrendBrief: topics, tags)
    """

    @staticmethod
    def build(
        task: str,
        text: str,
        fields: Dict[str, str],
        vocabulary: Optional[List[str]] = None,
        examples: Optional[List[Dict]] = None,
        constraints: Optional[List[str]] = None,
    ) -> str:
        """Build an extraction prompt.

        Args:
            task: What to extract (Vietnamese description).
            text: Input text to extract from.
            fields: Output fields {field_name: description}.
            vocabulary: Domain-specific terms to recognize.
            examples: Few-shot examples.
            constraints: Rules for extraction.

        Returns:
            Formatted prompt string.
        """
        parts = []

        # Instruction
        parts.append("Bạn là hệ thống trích xuất thông tin từ văn bản tiếng Việt.")
        parts.append(f"NHIỆM VỤ: {task}")
        parts.append("")

        # Vocabulary hints
        if vocabulary:
            parts.append(f"TỪ VỰNG CHUYÊN NGÀNH: {', '.join(vocabulary[:20])}")
            parts.append("")

        # Constraints
        all_constraints = [
            "Trích xuất CHÍNH XÁC — không suy đoán thêm",
            "Nếu không tìm thấy thông tin → để trống hoặc null",
            "Xử lý từ lóng/viết tắt tiếng Việt",
        ]
        if constraints:
            all_constraints.extend(constraints)

        parts.append("QUY TẮC:")
        for c in all_constraints:
            parts.append(f"- {c}")
        parts.append("")

        # Examples
        if examples:
            parts.append("VÍ DỤ:")
            for i, ex in enumerate(examples[:3], 1):
                parts.append(f"  Ví dụ {i}:")
                parts.append(f"    Input: \"{ex.get('input', '')}\"")
                parts.append(f"    Output: {json.dumps(ex.get('output', {}), ensure_ascii=False)}")
            parts.append("")

        # Input text
        parts.append("VĂN BẢN ĐẦU VÀO:")
        parts.append(f"\"{text[:2000]}\"")
        parts.append("")

        # Output schema
        parts.append("ĐỊNH DẠNG ĐẦU RA (JSON hợp lệ):")
        parts.append("{")
        for field, desc in fields.items():
            parts.append(f'  "{field}": <giá trị>  // {desc}')
        parts.append("}")
        parts.append("")
        parts.append("Chỉ trả lời JSON. Không giải thích.")

        return "\n".join(parts)

    @staticmethod
    def build_symptoms_medical(user_message: str) -> str:
        """Build medical symptom extraction prompt (CareMate).

        Args:
            user_message: Patient's description in Vietnamese.

        Returns:
            Formatted prompt.
        """
        return ExtractionTemplate.build(
            task="Trích xuất triệu chứng từ mô tả của bệnh nhân",
            text=user_message,
            fields={
                "primary_symptom": "Triệu chứng chính",
                "body_system": "Hệ cơ quan (hô hấp/tiêu hóa/thần kinh/tim mạch/cơ xương/da liễu/khác)",
                "duration": "Thời gian (nếu đề cập)",
                "severity_hint": "low/medium/high/emergency",
                "related_symptoms": "Triệu chứng phụ (list)",
            },
            vocabulary=[
                "đau đầu", "sốt", "ho", "khó thở", "đau bụng", "tiêu chảy",
                "buồn nôn", "chóng mặt", "mệt mỏi", "đau ngực", "phát ban",
                "sưng", "đỏ", "ngứa", "ớn lạnh", "ra mồ hôi",
            ],
            examples=[
                {
                    "input": "Em bị đau đầu 2 ngày rồi, uống thuốc không đỡ, kèm sốt nhẹ",
                    "output": {
                        "primary_symptom": "đau đầu",
                        "body_system": "thần kinh",
                        "duration": "2 ngày",
                        "severity_hint": "medium",
                        "related_symptoms": ["sốt nhẹ", "không đáp ứng thuốc giảm đau"],
                    },
                },
            ],
        )

    @staticmethod
    def build_symptoms_car(user_message: str) -> str:
        """Build car symptom extraction prompt (Doctor Car).

        Args:
            user_message: Driver's description in Vietnamese.

        Returns:
            Formatted prompt.
        """
        return ExtractionTemplate.build(
            task="Trích xuất triệu chứng xe từ mô tả của tài xế",
            text=user_message,
            fields={
                "symptom_normalized": "Triệu chứng chuẩn hóa (kỹ thuật)",
                "body_system": "Hệ thống: động cơ/phanh/treo/điện/hộp số/làm mát/nhiên liệu/khác",
                "when_occurs": "Khi nào: khởi động/phanh/tăng tốc/luôn luôn/thỉnh thoảng",
                "severity_hint": "low/medium/high/critical",
                "related_parts": "Bộ phận liên quan (list)",
            },
            vocabulary=[
                "kêu cọc cọc", "rung", "khói trắng", "khói đen", "hao xăng",
                "đèn báo", "khó khởi động", "hết ắc quy", "bó phanh",
                "lệch lái", "rò dầu", "nóng máy", "nước sôi", "đèn check engine",
            ],
            examples=[
                {
                    "input": "xe em kêu cọc cọc ở bánh trước bên phải khi đi qua ổ gà",
                    "output": {
                        "symptom_normalized": "tiếng kêu bất thường hệ treo trước phải",
                        "body_system": "treo",
                        "when_occurs": "đi qua ổ gà/mặt đường xấu",
                        "severity_hint": "medium",
                        "related_parts": ["rotuyn", "cao su chữ A", "giảm chấn"],
                    },
                },
            ],
        )

    @staticmethod
    def build_financial(text: str) -> str:
        """Build financial data extraction prompt (FinTax).

        Args:
            text: Receipt, invoice, or financial document text.

        Returns:
            Formatted prompt.
        """
        return ExtractionTemplate.build(
            task="Trích xuất thông tin tài chính từ chứng từ/hóa đơn",
            text=text,
            fields={
                "amount_vnd": "Số tiền (VND, chỉ số)",
                "category": "Loại: thu nhập/chi tiêu/thuế/phí",
                "description": "Mô tả giao dịch",
                "date": "Ngày (dd/MM/yyyy nếu có)",
                "source": "Nguồn: lương/freelance/bán hàng/cho thuê/khác",
            },
            vocabulary=[
                "TNCN", "thuế", "giảm trừ", "phụ thuộc", "BHXH", "BHYT",
                "tổng thu nhập", "thu nhập chịu thuế", "MST", "hóa đơn",
            ],
            constraints=[
                "Số tiền phải là số nguyên (VND), bỏ dấu chấm/phẩy ngăn cách",
                "Nếu không rõ ngày → để null",
            ],
        )
