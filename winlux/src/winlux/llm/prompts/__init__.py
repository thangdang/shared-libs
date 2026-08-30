"""Vietnamese prompt template library for LLM tasks.

Optimized for qwen2.5 family models. Each template provides a structured
prompt format for a specific task type.

Usage:
    from winlux.llm.prompts import classification_vi, generation_vi

    prompt = classification_vi.build(
        task="Phân loại ý định",
        input_data={"query": "..."},
        categories=["search", "compare", "recommend"],
    )
"""

from winlux.llm.prompts.classification_vi import ClassificationTemplate
from winlux.llm.prompts.generation_vi import GenerationTemplate
from winlux.llm.prompts.summarization_vi import SummarizationTemplate
from winlux.llm.prompts.extraction_vi import ExtractionTemplate
from winlux.llm.prompts.reasoning_vi import ReasoningTemplate

__all__ = [
    "ClassificationTemplate",
    "GenerationTemplate",
    "SummarizationTemplate",
    "ExtractionTemplate",
    "ReasoningTemplate",
]
