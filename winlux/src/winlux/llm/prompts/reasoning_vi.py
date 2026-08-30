"""Vietnamese reasoning/analysis prompt template.

Optimized for qwen3:8b (with /think mode). Designed for complex
reasoning tasks: medical diagnosis, car diagnosis, tax rule interpretation,
content planning.

Key patterns:
- Chain-of-thought encouragement
- Multiple hypothesis consideration
- Confidence-graded output
- Source citation
"""

import json
from typing import Dict, List, Optional


class ReasoningTemplate:
    """Build reasoning prompts for complex Vietnamese analysis tasks.

    Optimized for:
    - Medical symptom analysis (CareMate)
    - Car diagnostic reasoning (Doctor Car)
    - Tax rule interpretation (FinTax)
    - Content strategy planning (Childhood)
    - Deep trend analysis (TrendBrief)
    """

    @staticmethod
    def build(
        task: str,
        context: Dict,
        output_fields: Dict[str, str],
        reasoning_steps: Optional[List[str]] = None,
        constraints: Optional[List[str]] = None,
        examples: Optional[List[Dict]] = None,
        require_confidence: bool = True,
        require_sources: bool = False,
    ) -> str:
        """Build a reasoning prompt with chain-of-thought.

        Args:
            task: Analysis task description.
            context: Input data for analysis.
            output_fields: Expected output structure.
            reasoning_steps: Guided steps for reasoning.
            constraints: Rules and limitations.
            examples: Few-shot examples.
            require_confidence: Include confidence field.
            require_sources: Require source citations.

        Returns:
            Formatted prompt string.
        """
        parts = []

        # System instruction
        parts.append(
            "Bạn là chuyên gia phân tích. Suy luận từng bước, "
            "cân nhắc nhiều khả năng, và đưa ra kết luận có căn cứ."
        )
        parts.append(f"NHIỆM VỤ: {task}")
        parts.append("")

        # Guided reasoning steps
        if reasoning_steps:
            parts.append("CÁC BƯỚC SUY LUẬN:")
            for i, step in enumerate(reasoning_steps, 1):
                parts.append(f"  {i}. {step}")
            parts.append("")

        # Constraints
        all_constraints = [
            "Cân nhắc ít nhất 2-3 khả năng trước khi kết luận",
            "Nếu không đủ thông tin → nói rõ cần hỏi thêm gì",
            "Đánh giá mức tin cậy cho mỗi kết luận",
        ]
        if constraints:
            all_constraints.extend(constraints)
        if require_sources:
            all_constraints.append("Trích dẫn nguồn cho mỗi kết luận (nếu có)")

        parts.append("QUY TẮC:")
        for c in all_constraints:
            parts.append(f"- {c}")
        parts.append("")

        # Examples
        if examples:
            parts.append("VÍ DỤ:")
            for i, ex in enumerate(examples[:2], 1):
                parts.append(f"  Ví dụ {i}:")
                parts.append(f"    Input: {json.dumps(ex.get('input', {}), ensure_ascii=False)}")
                parts.append(f"    Output: {json.dumps(ex.get('output', {}), ensure_ascii=False)}")
            parts.append("")

        # Context
        parts.append("DỮ LIỆU ĐẦU VÀO:")
        parts.append(json.dumps(context, ensure_ascii=False, indent=2))
        parts.append("")

        # Output format
        final_fields = dict(output_fields)
        if require_confidence and "confidence" not in final_fields:
            final_fields["confidence"] = "0.0-1.0 mức tin cậy"

        parts.append("ĐỊNH DẠNG ĐẦU RA (JSON hợp lệ):")
        parts.append("{")
        for field, desc in final_fields.items():
            parts.append(f'  "{field}": <giá trị>  // {desc}')
        parts.append("}")
        parts.append("")
        parts.append("Suy luận kỹ trước khi trả lời. Chỉ trả lời JSON cuối cùng.")

        return "\n".join(parts)

    @staticmethod
    def build_medical_diagnosis(symptoms: List[str], patient_info: Dict = None) -> str:
        """Build medical symptom analysis prompt (CareMate).

        Args:
            symptoms: List of patient symptoms.
            patient_info: Optional {age, gender, medical_history}.

        Returns:
            Formatted prompt.
        """
        context = {"symptoms": symptoms}
        if patient_info:
            context["patient_info"] = patient_info

        return ReasoningTemplate.build(
            task="Phân tích triệu chứng và đưa ra các khả năng bệnh lý",
            context=context,
            output_fields={
                "possible_conditions": "Danh sách khả năng (tối đa 3, kèm %)",
                "most_likely": "Khả năng cao nhất",
                "severity": "low/medium/high/emergency",
                "next_steps": "Bước tiếp theo nên làm (list)",
                "red_flags": "Dấu hiệu nguy hiểm cần cấp cứu (list, nếu có)",
                "follow_up_questions": "Câu hỏi cần hỏi thêm (list)",
            },
            reasoning_steps=[
                "Xác định hệ cơ quan liên quan từ triệu chứng",
                "Liệt kê các bệnh lý có thể gây ra tổ hợp triệu chứng này",
                "Loại trừ các nguyên nhân nguy hiểm (red flags)",
                "Xếp hạng theo khả năng xảy ra",
                "Đề xuất bước tiếp theo phù hợp mức độ",
            ],
            constraints=[
                "KHÔNG chẩn đoán bệnh — chỉ gợi ý khả năng",
                "Nếu có dấu hiệu cấp cứu → severity = emergency, nhắc gọi 115",
                "Luôn khuyên gặp bác sĩ nếu triệu chứng kéo dài > 3 ngày",
            ],
        )

    @staticmethod
    def build_car_diagnosis(symptoms: List[str], vehicle: Dict) -> str:
        """Build car diagnostic reasoning prompt (Doctor Car).

        Args:
            symptoms: List of car symptoms.
            vehicle: {brand, model, year, mileage}.

        Returns:
            Formatted prompt.
        """
        return ReasoningTemplate.build(
            task="Chẩn đoán nguyên nhân hỏng xe dựa trên triệu chứng",
            context={"symptoms": symptoms, "vehicle": vehicle},
            output_fields={
                "possible_causes": "Top 3 nguyên nhân (list, kèm % tin cậy)",
                "most_likely": "Nguyên nhân khả năng cao nhất",
                "severity": "1-5 (1=nhẹ, 5=nguy hiểm)",
                "is_safe_to_drive": "true/false",
                "immediate_action": "Hành động ngay: tiếp tục lái / lái chậm / dừng ngay",
                "estimated_cost_range": "Ước tính chi phí sửa (VND)",
                "explanation_vi": "Giải thích dễ hiểu cho tài xế",
            },
            reasoning_steps=[
                "Xác định hệ thống xe liên quan (động cơ/phanh/treo/điện/...)",
                "Liệt kê nguyên nhân phổ biến cho triệu chứng này + đời xe",
                "Đánh giá mức độ nguy hiểm (ảnh hưởng an toàn?)",
                "Ước tính chi phí sửa chữa khu vực VN",
                "Đề xuất hành động phù hợp",
            ],
            constraints=[
                "Phanh/lái/túi khí bất thường → LUÔN severity ≥ 4, is_safe_to_drive = false",
                "Xét đến tuổi xe và km để ưu tiên nguyên nhân phổ biến",
                "Giá ước tính cho thị trường Việt Nam (OEM và aftermarket)",
            ],
            require_sources=True,
        )

    @staticmethod
    def build_tax_analysis(question: str, tax_context: Dict = None) -> str:
        """Build tax rule reasoning prompt (FinTax).

        Args:
            question: User's tax question.
            tax_context: {income_type, amount, year, deductions}.

        Returns:
            Formatted prompt.
        """
        return ReasoningTemplate.build(
            task="Phân tích và giải thích quy định thuế TNCN Việt Nam",
            context={"question": question, **(tax_context or {})},
            output_fields={
                "answer_vi": "Câu trả lời bằng tiếng Việt dễ hiểu",
                "applicable_law": "Luật/thông tư/nghị định áp dụng",
                "calculation_notes": "Ghi chú tính toán (nếu liên quan)",
                "examples": "Ví dụ minh họa (list)",
                "warnings": "Lưu ý quan trọng (list)",
            },
            reasoning_steps=[
                "Xác định loại thuế liên quan (TNCN/TNDN/VAT/khác)",
                "Tra cứu quy định hiện hành (Luật 04/2007, sửa đổi 2024-2025)",
                "Áp dụng vào trường hợp cụ thể",
                "Nêu các ngoại lệ hoặc trường hợp đặc biệt",
            ],
            constraints=[
                "KHÔNG tính toán số tiền — chỉ giải thích quy tắc",
                "Trích dẫn số hiệu thông tư/nghị định",
                "Nếu quy định phức tạp → khuyên tham vấn kế toán",
                "Áp dụng quy định năm 2026 (mới nhất)",
            ],
            require_sources=True,
        )
