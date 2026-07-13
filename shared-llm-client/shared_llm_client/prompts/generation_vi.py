"""Vietnamese content generation prompt template.

Optimized for qwen2.5:7b and qwen3:8b models.
Designed for generating Vietnamese text content: titles, descriptions,
product comparisons, health responses, tax explanations.

Key patterns:
- Role + tone instruction
- Audience-aware (Vietnamese market context)
- Length control
- Factual grounding (never hallucinate data)
"""

import json
from typing import Dict, List, Optional


class GenerationTemplate:
    """Build generation prompts for Vietnamese content creation.

    Optimized for:
    - Product comparison text
    - Health advice responses
    - Tax explanations
    - Article titles/descriptions
    - Shopping recommendations
    """

    @staticmethod
    def build(
        task: str,
        context: Dict,
        tone: str = "thân thiện",
        max_words: int = 200,
        audience: str = "người dùng Việt Nam",
        constraints: Optional[List[str]] = None,
        output_fields: Optional[Dict[str, str]] = None,
        examples: Optional[List[Dict]] = None,
    ) -> str:
        """Build a generation prompt.

        Args:
            task: What to generate (Vietnamese description).
            context: Input context data.
            tone: Writing tone (thân thiện, chuyên nghiệp, nghiêm túc).
            max_words: Approximate word limit.
            audience: Target audience description.
            constraints: Things to avoid or rules to follow.
            output_fields: If structured JSON output needed.
            examples: Few-shot examples.

        Returns:
            Formatted prompt string.
        """
        parts = []

        # Role + instructions
        parts.append(
            f"Bạn là trợ lý AI viết nội dung tiếng Việt cho {audience}. "
            f"Giọng văn: {tone}. Viết ngắn gọn, dễ hiểu."
        )
        parts.append(f"NHIỆM VỤ: {task}")
        parts.append(f"ĐỘ DÀI: Tối đa {max_words} từ.")
        parts.append("")

        # Constraints
        all_constraints = [
            "Viết bằng tiếng Việt, không dùng tiếng Anh trừ tên sản phẩm/thương hiệu",
            "Không bịa thông tin — nếu không chắc chắn thì nói rõ",
            "Dùng đơn vị VND cho giá tiền (VD: 1.500.000đ)",
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
            for i, ex in enumerate(examples[:2], 1):
                parts.append(f"  Ví dụ {i}:")
                if "input" in ex:
                    parts.append(f"    Input: {json.dumps(ex['input'], ensure_ascii=False)}")
                if "output" in ex:
                    output_str = ex["output"] if isinstance(ex["output"], str) else json.dumps(ex["output"], ensure_ascii=False)
                    parts.append(f"    Output: {output_str}")
            parts.append("")

        # Context
        parts.append("DỮ LIỆU ĐẦU VÀO:")
        parts.append(json.dumps(context, ensure_ascii=False, indent=2))
        parts.append("")

        # Output format
        if output_fields:
            parts.append("ĐỊNH DẠNG ĐẦU RA (JSON hợp lệ):")
            parts.append("{")
            for field, desc in output_fields.items():
                parts.append(f'  "{field}": <giá trị>  // {desc}')
            parts.append("}")
            parts.append("")
            parts.append("Chỉ trả lời JSON. Không giải thích thêm.")
        else:
            parts.append("Trả lời trực tiếp bằng tiếng Việt. Không thêm prefix hay suffix.")

        return "\n".join(parts)

    @staticmethod
    def build_comparison(
        products: List[Dict],
        criteria: List[str] = None,
        audience: str = "người mua hàng Việt Nam",
    ) -> str:
        """Build product comparison generation prompt.

        Args:
            products: List of product dicts {name, price, specs...}.
            criteria: Comparison criteria.
            audience: Target audience.

        Returns:
            Formatted prompt string.
        """
        default_criteria = ["Giá", "Chất lượng", "Tính năng nổi bật", "Phù hợp ai"]
        criteria = criteria or default_criteria

        return GenerationTemplate.build(
            task="So sánh các sản phẩm và gợi ý sản phẩm phù hợp nhất",
            context={"products": products, "criteria": criteria},
            tone="tư vấn chuyên gia",
            max_words=300,
            audience=audience,
            constraints=[
                "So sánh khách quan — liệt kê ưu/nhược từng sản phẩm",
                "Gợi ý rõ ràng: sản phẩm nào phù hợp ai/nhu cầu gì",
                "Không thiên vị — dựa trên dữ liệu thực",
            ],
            output_fields={
                "summary_vi": "Tóm tắt so sánh (2-3 câu)",
                "winner": "Sản phẩm nổi bật nhất",
                "key_differences": "Điểm khác biệt chính (list)",
                "recommendation_vi": "Gợi ý mua (1-2 câu)",
            },
        )

    @staticmethod
    def build_health_response(
        symptoms: str,
        severity: str,
        context: Dict = None,
    ) -> str:
        """Build health response generation prompt (CareMate).

        Args:
            symptoms: Patient symptoms.
            severity: Severity level.
            context: Additional medical context.

        Returns:
            Formatted prompt string.
        """
        return GenerationTemplate.build(
            task="Tư vấn sức khỏe ban đầu dựa trên triệu chứng (KHÔNG thay thế bác sĩ)",
            context={
                "symptoms": symptoms,
                "severity": severity,
                **(context or {}),
            },
            tone="nghiêm túc, quan tâm",
            max_words=200,
            audience="bệnh nhân Việt Nam",
            constraints=[
                "LUÔN khuyên đi khám bác sĩ nếu triệu chứng nặng",
                "KHÔNG chẩn đoán bệnh — chỉ gợi ý khả năng",
                "LUÔN ghi chú: 'Đây chỉ là tham khảo, vui lòng gặp bác sĩ'",
                "Nếu nghi ngờ cấp cứu → nhắc gọi 115 NGAY",
            ],
            output_fields={
                "response_vi": "Câu trả lời (tiếng Việt)",
                "severity_flag": "normal/warning/urgent",
                "next_steps": "Bước tiếp theo nên làm (list)",
                "disclaimer": "Luôn = 'Đây là tham khảo, không thay thế bác sĩ'",
            },
        )
