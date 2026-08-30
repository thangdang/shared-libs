"""Vietnamese summarization prompt template.

Optimized for qwen2.5:7b. Designed for summarizing news articles,
product reviews, medical articles, and financial regulations.

Key patterns:
- Bullet-point output (Vietnamese readers prefer scannable content)
- Key fact extraction
- Sentiment detection
- Length control (target word count)
"""

import json
from typing import Dict, List, Optional


class SummarizationTemplate:
    """Build summarization prompts for Vietnamese content.

    Optimized for:
    - News article summarization (TrendBrief)
    - Product review summarization (SmartBuy)
    - Health article summarization (CareMate)
    - Tax regulation summarization (FinTax)
    """

    @staticmethod
    def build(
        content: str,
        style: str = "bullets",
        max_bullets: int = 5,
        target_words: int = 100,
        focus: Optional[str] = None,
        output_fields: Optional[Dict[str, str]] = None,
        examples: Optional[List[Dict]] = None,
    ) -> str:
        """Build a summarization prompt.

        Args:
            content: Text to summarize.
            style: Output style ("bullets", "paragraph", "one_line").
            max_bullets: Max bullet points for bullet style.
            target_words: Target output word count.
            focus: What aspect to focus on (optional).
            output_fields: Structured JSON output fields.
            examples: Few-shot examples.

        Returns:
            Formatted prompt string.
        """
        parts = []

        # Instruction
        parts.append("Bạn là chuyên gia tóm tắt nội dung tiếng Việt.")

        if style == "bullets":
            parts.append(f"NHIỆM VỤ: Tóm tắt nội dung sau thành {max_bullets} gạch đầu dòng ngắn gọn.")
        elif style == "one_line":
            parts.append("NHIỆM VỤ: Tóm tắt nội dung sau thành 1 câu duy nhất.")
        else:
            parts.append(f"NHIỆM VỤ: Tóm tắt nội dung sau trong khoảng {target_words} từ.")

        if focus:
            parts.append(f"TẬP TRUNG VÀO: {focus}")
        parts.append("")

        # Rules
        parts.append("QUY TẮC:")
        parts.append("- Giữ thông tin quan trọng, bỏ chi tiết phụ")
        parts.append("- Viết bằng tiếng Việt tự nhiên")
        parts.append("- Không thêm ý kiến cá nhân")
        parts.append("- Giữ nguyên số liệu, tên riêng")
        parts.append("")

        # Examples
        if examples:
            parts.append("VÍ DỤ:")
            for i, ex in enumerate(examples[:2], 1):
                parts.append(f"  Ví dụ {i}: {ex.get('output', '')}")
            parts.append("")

        # Content (truncate if very long)
        content_trimmed = content[:4000] if len(content) > 4000 else content
        parts.append("NỘI DUNG CẦN TÓM TẮT:")
        parts.append(content_trimmed)
        parts.append("")

        # Output format
        if output_fields:
            parts.append("ĐỊNH DẠNG ĐẦU RA (JSON hợp lệ):")
            parts.append("{")
            for field, desc in output_fields.items():
                parts.append(f'  "{field}": <giá trị>  // {desc}')
            parts.append("}")
            parts.append("")
            parts.append("Chỉ trả lời JSON.")
        elif style == "bullets":
            parts.append("Trả lời dạng gạch đầu dòng (mỗi dòng bắt đầu bằng '• '):")
        elif style == "one_line":
            parts.append("Trả lời 1 câu duy nhất:")
        else:
            parts.append("Trả lời đoạn văn ngắn gọn:")

        return "\n".join(parts)

    @staticmethod
    def build_news(title: str, content: str, max_bullets: int = 5) -> str:
        """Build news article summarization prompt (TrendBrief).

        Args:
            title: Article title.
            content: Article body.
            max_bullets: Number of bullet points.

        Returns:
            Formatted prompt.
        """
        return SummarizationTemplate.build(
            content=f"Tiêu đề: {title}\n\n{content}",
            style="bullets",
            max_bullets=max_bullets,
            focus="thông tin mới, số liệu quan trọng, tác động",
            output_fields={
                "title_vi": "Tiêu đề tóm tắt (ngắn, hấp dẫn)",
                "bullets": "List các điểm chính (tối đa 5)",
                "key_takeaway": "Điểm nhấn quan trọng nhất (1 câu)",
                "sentiment": "positive/negative/neutral",
            },
        )

    @staticmethod
    def build_reviews(reviews: List[str], product_name: str) -> str:
        """Build product review summarization prompt (SmartBuy).

        Args:
            reviews: List of review texts.
            product_name: Product being reviewed.

        Returns:
            Formatted prompt.
        """
        content = f"Sản phẩm: {product_name}\n\nĐánh giá:\n"
        for i, r in enumerate(reviews[:15], 1):
            content += f"{i}. {r[:200]}\n"

        return SummarizationTemplate.build(
            content=content,
            style="bullets",
            max_bullets=5,
            focus="ưu điểm, nhược điểm, vấn đề hay gặp",
            output_fields={
                "overall_sentiment": "positive/mixed/negative",
                "pros_vi": "Ưu điểm (list tiếng Việt)",
                "cons_vi": "Nhược điểm (list tiếng Việt)",
                "common_issues": "Vấn đề hay gặp (list)",
                "rating_estimate": "Ước tính rating 1-5",
            },
        )
