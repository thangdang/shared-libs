"""Vietnamese prompt template library for LLM tasks.

Optimized for qwen2.5 family models. Each template provides a structured
prompt format for a specific task type.

Usage:
    from shared_llm_client.prompts import classification_vi, generation_vi

    prompt = classification_vi.build(
        task="Phân loại ý định",
        input_data={"query": "..."},
        categories=["search", "compare", "recommend"],
    )
"""

from shared_llm_client.prompts.classification_vi import ClassificationTemplate
from shared_llm_client.prompts.generation_vi import GenerationTemplate
from shared_llm_client.prompts.summarization_vi import SummarizationTemplate
from shared_llm_client.prompts.extraction_vi import ExtractionTemplate
from shared_llm_client.prompts.reasoning_vi import ReasoningTemplate

__all__ = [
    "ClassificationTemplate",
    "GenerationTemplate",
    "SummarizationTemplate",
    "ExtractionTemplate",
    "ReasoningTemplate",
]
