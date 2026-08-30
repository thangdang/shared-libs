"""RAG Prompt Builder — Task 5.

Template-based prompt construction that constrains LLM to retrieved data only.
Enforces: "CHỈ trả lời dựa trên dữ liệu bên dưới. KHÔNG sử dụng kiến thức chung."
"""

import logging

logger = logging.getLogger(__name__)


class RAGPromptBuilder:
    """Build grounded prompts that constrain LLM to retrieved data only.

    Usage:
        builder = RAGPromptBuilder()
        prompt = builder.build(
            query="iPhone 15 giá bao nhiêu?",
            contexts=[
                {"section_name": "SẢN PHẨM", "content": "iPhone 15 | Apple | 19.990.000₫"},
                {"section_name": "LỊCH SỬ GIÁ", "content": "30d avg: 20.500.000₫, min: 19.500.000₫"},
            ],
            config={"product_name": "SmartBuy", "no_data_response": "Sản phẩm chưa có trong hệ thống."}
        )
    """

    SYSTEM_TEMPLATE = """Bạn là trợ lý AI của {product_name}.
QUY TẮC BẮT BUỘC:
1. CHỈ trả lời dựa trên dữ liệu được cung cấp bên dưới.
2. KHÔNG sử dụng kiến thức chung hoặc thông tin bên ngoài.
3. Nếu không có dữ liệu liên quan, trả lời: "{no_data_response}"
4. Khi đưa ra thông tin, trích dẫn nguồn: "[Nguồn: ...]"
5. Trả lời bằng tiếng Việt, ngắn gọn, chính xác.
{extra_constraints}"""

    def build(self, query: str, contexts: list[dict], config: dict) -> str:
        """Build a grounded RAG prompt.

        Args:
            query: User's original question
            contexts: List of {section_name: str, content: str} dicts
            config: {product_name, no_data_response, extra_constraints (optional)}

        Returns:
            Formatted prompt string ready for LLM
        """
        extra = config.get("extra_constraints", "")
        if extra:
            extra = f"\n{extra}"

        system = self.SYSTEM_TEMPLATE.format(
            product_name=config.get("product_name", "AI Assistant"),
            no_data_response=config.get("no_data_response", "Tôi chưa có thông tin về vấn đề này."),
            extra_constraints=extra,
        )

        # Build context sections
        context_sections = []
        for ctx in contexts:
            section_name = ctx.get("section_name", "DỮ LIỆU")
            content = ctx.get("content", "")
            if content.strip():
                context_sections.append(f"=== {section_name} ===\n{content}")

        context_text = "\n\n".join(context_sections) if context_sections else "(Không có dữ liệu liên quan)"

        return f"""{system}

{context_text}

=== CÂU HỎI ===
{query}

Trả lời:"""

    def build_with_history(self, query: str, contexts: list[dict], config: dict, history: list[dict] = None) -> str:
        """Build prompt with conversation history context.

        Args:
            history: List of {role: "user"|"assistant", content: str}
        """
        base_prompt = self.build(query, contexts, config)

        if not history:
            return base_prompt

        # Add conversation history before the question
        history_text = "\n".join(
            f"{'Người dùng' if h['role'] == 'user' else 'Trợ lý'}: {h['content']}"
            for h in history[-3:]  # Last 3 turns only
        )

        return base_prompt.replace(
            "=== CÂU HỎI ===",
            f"=== LỊCH SỬ HỘI THOẠI ===\n{history_text}\n\n=== CÂU HỎI ===",
        )
