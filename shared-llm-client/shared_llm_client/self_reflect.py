"""Self-reflection — AI validates its own output before returning.

Uses cheapest model (qwen2.5:1.5b) for a quick self-check pass.
Product-specific criteria configs determine what to check.
≤3 seconds overhead per reflection.

Usage:
    result = await self_reflect(
        output="Script about xe đạp tuổi thơ...",
        criteria=CHILDHOOD_SCRIPT_CRITERIA,
        llm_fn=llm_client.generate,
    )
    if not result["passed"]:
        # Re-generate or fix issues
"""

import json
import logging
from typing import Any, Callable, Coroutine, Dict, List, Optional

logger = logging.getLogger(__name__)

# Per-product reflection criteria
REFLECTION_CRITERIA = {
    "childhood": {
        "script": [
            "Hook mạnh trong 3 giây đầu (có câu hỏi hoặc tuyên bố gây tò mò)",
            "Nội dung theo đúng channel identity (tone, audience)",
            "Có CTA cuối video (subscribe, like, comment)",
            "Không chứa nội dung nhạy cảm hoặc vi phạm bản quyền",
            "Độ dài phù hợp (30-90 giây khi đọc)",
        ],
        "quality_gate": [
            "Phù hợp với niche của channel",
            "Không trùng lặp với script gần đây",
            "Factual accuracy (không bịa thông tin)",
        ],
    },
    "caremate": {
        "response": [
            "Có disclaimer y tế (chỉ mang tính tham khảo)",
            "Không đưa ra chẩn đoán khẳng định (dùng 'có thể là')",
            "Gợi ý gặp bác sĩ cho triệu chứng nghiêm trọng",
            "Source citation nếu có",
            "Ngôn ngữ dễ hiểu cho người Việt",
        ],
        "severity": [
            "Emergency keywords detected → must be HIGH",
            "Consistent with symptom description",
        ],
    },
    "fintax": {
        "classification": [
            "Income category matches Vietnamese tax law",
            "No calculation in AI output (rule engine handles math)",
            "Clear explanation of applicable bracket",
        ],
    },
    "smartbuy": {
        "recommendation": [
            "Price data comes from API (never AI-generated prices)",
            "Fair comparison (no single-brand bias)",
            "Vietnamese product names used correctly",
        ],
    },
    "trendbriefai": {
        "summary": [
            "Tóm tắt đúng nội dung bài gốc",
            "Không thêm thông tin không có trong nguồn",
            "Bullets ngắn gọn, dễ đọc",
            "Tone trung lập, không sensational",
        ],
    },
    "doctorcar": {
        "diagnosis": [
            "Dùng 'có thể là' — không khẳng định",
            "Có mức độ tin cậy (confidence %)",
            "Gợi ý đến garage cho vấn đề nghiêm trọng",
            "Source citation (TSB, OEM, community)",
            "Chi phí là khoảng giá, không phải số cố định",
        ],
    },
}


async def self_reflect(
    output: str,
    criteria: List[str],
    llm_fn: Callable[..., Coroutine],
    model: str = "qwen2.5:1.5b",
    max_retries: int = 1,
) -> Dict:
    """Run self-reflection on AI output.

    Uses cheapest model to quickly validate output against criteria.
    Target: ≤3 seconds overhead.

    Args:
        output: The AI-generated output to validate.
        criteria: List of criteria strings to check against.
        llm_fn: Async LLM generate function.
        model: Model for reflection (cheapest possible).
        max_retries: Not used for reflection itself, kept for API compat.

    Returns:
        Dict with:
        - passed: bool — all criteria met
        - score: float — 0.0-1.0
        - issues: list — failed criteria
        - suggestions: list — how to fix
    """
    if not output or not criteria:
        return {"passed": True, "score": 1.0, "issues": [], "suggestions": []}

    prompt = _build_reflection_prompt(output, criteria)

    try:
        response = await llm_fn(
            prompt=prompt,
            model=model,
            temperature=0.1,  # Very deterministic
            max_tokens=300,
            timeout=3.0,  # Hard 3s limit
        )

        # Parse reflection result
        result = _parse_reflection(response.content, criteria)
        return result

    except Exception as e:
        logger.warning(f"[SelfReflect] Failed (non-blocking): {e}")
        # On failure, assume output is OK (don't block pipeline)
        return {"passed": True, "score": 0.7, "issues": [], "suggestions": []}


def get_criteria(product: str, task_type: str) -> List[str]:
    """Get reflection criteria for a product/task combination.

    Args:
        product: Product name.
        task_type: Task type (e.g., "script", "response", "summary").

    Returns:
        List of criteria strings, or empty list if not configured.
    """
    product_criteria = REFLECTION_CRITERIA.get(product.lower(), {})
    return product_criteria.get(task_type, [])


def _build_reflection_prompt(output: str, criteria: List[str]) -> str:
    """Build the reflection evaluation prompt."""
    criteria_text = "\n".join(f"  {i+1}. {c}" for i, c in enumerate(criteria))

    return (
        "Đánh giá output sau theo các tiêu chí.\n"
        "Trả lời bằng JSON: {\"passed\": true/false, \"score\": 0.0-1.0, "
        "\"issues\": [\"...\"], \"suggestions\": [\"...\"]}\n\n"
        f"OUTPUT CẦN ĐÁNH GIÁ:\n{output[:800]}\n\n"
        f"TIÊU CHÍ:\n{criteria_text}\n\n"
        "Respond with JSON only."
    )


def _parse_reflection(response: str, criteria: List[str]) -> Dict:
    """Parse reflection response into structured result."""
    try:
        # Clean and parse JSON
        content = response.strip()
        if content.startswith("```"):
            content = content.split("```")[1] if "```" in content[3:] else content[3:]
            content = content.strip()
            if content.startswith("json"):
                content = content[4:].strip()

        start = content.find("{")
        end = content.rfind("}")
        if start != -1 and end != -1:
            content = content[start:end + 1]

        parsed = json.loads(content)

        return {
            "passed": parsed.get("passed", True),
            "score": float(parsed.get("score", 0.7)),
            "issues": parsed.get("issues", [])[:5],
            "suggestions": parsed.get("suggestions", [])[:3],
        }

    except (json.JSONDecodeError, ValueError):
        # If can't parse, default to pass (don't block)
        logger.debug("[SelfReflect] Could not parse reflection response")
        return {"passed": True, "score": 0.7, "issues": [], "suggestions": []}
