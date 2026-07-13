"""Vietnamese classification prompt template.

Optimized for qwen2.5:1.5b and qwen2.5:7b models.
Designed for intent classification, category assignment, severity scoring.

Key patterns:
- Clear instruction in Vietnamese
- Enumerated category list
- JSON output enforcement
- Few-shot examples when provided
"""

import json
from typing import Dict, List, Optional


class ClassificationTemplate:
    """Build classification prompts for Vietnamese LLM tasks.

    Optimized for:
    - Intent classification (shopping, health, tax, car)
    - Category assignment (articles, products, symptoms)
    - Severity scoring (1-5 or low/medium/high)
    - Binary decisions (yes/no, safe/unsafe)
    """

    @staticmethod
    def build(
        task: str,
        input_data: Dict,
        categories: List[str],
        output_fields: Optional[Dict[str, str]] = None,
        examples: Optional[List[Dict]] = None,
        constraints: Optional[List[str]] = None,
    ) -> str:
        """Build a classification prompt.

        Args:
            task: Task description in Vietnamese.
            input_data: Input to classify (dict).
            categories: Valid categories/classes.
            output_fields: Expected output fields {field_name: description}.
            examples: Few-shot examples [{input: ..., output: ...}].
            constraints: Additional constraints.

        Returns:
            Formatted prompt string.
        """
        parts = []

        # System instruction
        parts.append("Bạn là hệ thống phân loại. Phân tích đầu vào và phân loại chính xác.")
        parts.append(f"NHIỆM VỤ: {task}")
        parts.append("")

        # Categories
        parts.append(f"DANH MỤC HỢP LỆ: {', '.join(categories)}")
        parts.append("")

        # Constraints
        if constraints:
            parts.append("QUY TẮC:")
            for c in constraints:
                parts.append(f"- {c}")
            parts.append("")

        # Few-shot examples
        if examples:
            parts.append("VÍ DỤ:")
            for i, ex in enumerate(examples[:3], 1):
                parts.append(f"  Ví dụ {i}:")
                parts.append(f"    Input: {json.dumps(ex.get('input', {}), ensure_ascii=False)}")
                parts.append(f"    Output: {json.dumps(ex.get('output', {}), ensure_ascii=False)}")
            parts.append("")

        # Input
        parts.append("ĐẦU VÀO:")
        parts.append(json.dumps(input_data, ensure_ascii=False, indent=2))
        parts.append("")

        # Output format
        parts.append("ĐỊNH DẠNG ĐẦU RA (chỉ trả lời JSON hợp lệ):")
        if output_fields:
            parts.append("{")
            for field, desc in output_fields.items():
                parts.append(f'  "{field}": <giá trị>  // {desc}')
            parts.append("}")
        else:
            parts.append('{"category": "<một trong các danh mục trên>", "confidence": <0.0-1.0>}')
        parts.append("")
        parts.append("Chỉ trả lời JSON. Không giải thích.")

        return "\n".join(parts)

    @staticmethod
    def build_binary(
        task: str,
        input_data: Dict,
        positive_label: str = "yes",
        negative_label: str = "no",
        examples: Optional[List[Dict]] = None,
    ) -> str:
        """Build a binary classification prompt (yes/no, safe/unsafe, etc).

        Args:
            task: Task description.
            input_data: Input to classify.
            positive_label: Label for positive class.
            negative_label: Label for negative class.
            examples: Optional few-shot examples.

        Returns:
            Formatted prompt string.
        """
        return ClassificationTemplate.build(
            task=task,
            input_data=input_data,
            categories=[positive_label, negative_label],
            output_fields={
                "decision": f"{positive_label} hoặc {negative_label}",
                "reason": "Lý do ngắn gọn",
                "confidence": "0.0-1.0",
            },
            examples=examples,
        )

    @staticmethod
    def build_severity(
        task: str,
        input_data: Dict,
        scale: str = "1-5",
        examples: Optional[List[Dict]] = None,
    ) -> str:
        """Build a severity/rating classification prompt.

        Args:
            task: What to rate.
            input_data: Input to evaluate.
            scale: Rating scale (e.g., "1-5", "1-10", "low/medium/high").
            examples: Optional few-shot examples.

        Returns:
            Formatted prompt string.
        """
        if "/" in scale:
            categories = scale.split("/")
        else:
            categories = [scale]

        return ClassificationTemplate.build(
            task=task,
            input_data=input_data,
            categories=categories,
            output_fields={
                "score": f"Điểm trên thang {scale}",
                "reasoning": "Lý do đánh giá (tiếng Việt, 1-2 câu)",
                "confidence": "0.0-1.0",
            },
            examples=examples,
            constraints=[
                f"Điểm phải nằm trong thang {scale}",
                "Luôn giải thích lý do bằng tiếng Việt",
            ],
        )
