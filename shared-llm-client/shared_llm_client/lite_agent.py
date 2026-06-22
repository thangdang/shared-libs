"""LiteAgent — Single-call structured output agent.

Replaces heavyweight CrewAI for simple tasks (classification, scoring, extraction).
Single LLM call with Pydantic schema validation + retry on parse failure.

Handles 80%+ of tasks across all products.  CrewAI reserved only for
multi-agent creative workflows (Childhood content planning/script writing).

Usage:
    from shared_llm_client.lite_agent import LiteAgent

    agent = LiteAgent(llm_client)
    result = await agent.run(
        task="Classify this symptom into severity level",
        context={"symptoms": "đau đầu, sốt nhẹ", "duration": "2 days"},
        output_schema=SeveritySchema,
        model="qwen2.5:1.5b",
    )
"""

import json
import logging
from typing import Any, Dict, Optional, Type

from pydantic import BaseModel, ValidationError

logger = logging.getLogger(__name__)


class LiteAgentResult:
    """Result from LiteAgent execution."""

    def __init__(
        self,
        success: bool,
        data: Optional[Dict],
        raw_output: str,
        model: str,
        retries: int,
        error: Optional[str] = None,
    ):
        self.success = success
        self.data = data
        self.raw_output = raw_output
        self.model = model
        self.retries = retries
        self.error = error

    def to_dict(self) -> dict:
        return {
            "success": self.success,
            "data": self.data,
            "model": self.model,
            "retries": self.retries,
            "error": self.error,
        }


class LiteAgent:
    """Single-call structured output agent.

    Replaces CrewAI for simple tasks:
    - Classification (intent, category, severity)
    - Scoring (hook score, trend score, quality)
    - Extraction (entities, keywords, facts)
    - Simple generation (title, description, tags)

    NOT suitable for:
    - Multi-agent collaboration (use CrewAI)
    - Creative writing requiring iteration
    - Tasks needing tool use
    """

    def __init__(self, llm_client=None):
        """Initialize LiteAgent.

        Args:
            llm_client: LLMClient instance.  If None, creates one.
        """
        self._llm = llm_client

    def set_llm(self, llm_client):
        """Set LLM client (for lazy initialization)."""
        self._llm = llm_client

    async def run(
        self,
        task: str,
        context: Dict[str, Any],
        output_schema: Type[BaseModel],
        model: str = "qwen2.5:7b",
        temperature: float = 0.3,
        max_retries: int = 1,
        few_shot_examples: Optional[list] = None,
    ) -> LiteAgentResult:
        """Execute a single-call structured task.

        Args:
            task: Task description (what to do).
            context: Input data dict (the data to process).
            output_schema: Pydantic model class for output validation.
            model: LLM model to use.
            temperature: Lower = more deterministic (good for classification).
            max_retries: Extra retries on schema validation failure.
            few_shot_examples: Optional list of example input→output pairs.

        Returns:
            LiteAgentResult with validated data or error.
        """
        if self._llm is None:
            raise RuntimeError("LLM client not initialized. Call set_llm() first.")

        # Build prompt
        prompt = self._build_prompt(task, context, output_schema, few_shot_examples)

        # Try up to max_retries + 1 times
        last_error = None
        for attempt in range(max_retries + 1):
            try:
                response = await self._llm.generate(
                    prompt=prompt,
                    model=model,
                    temperature=temperature,
                    max_tokens=1000,
                    json_schema={"type": "object"},  # Request JSON mode
                    skip_cache=attempt > 0,  # Don't cache retries
                )

                # Parse JSON
                content = response.content.strip()
                # Handle common formatting issues
                content = self._clean_json(content)
                parsed = json.loads(content)

                # Validate against Pydantic schema
                validated = output_schema(**parsed)

                return LiteAgentResult(
                    success=True,
                    data=validated.model_dump(),
                    raw_output=response.content,
                    model=model,
                    retries=attempt,
                )

            except json.JSONDecodeError as e:
                last_error = f"JSON parse error: {e}"
                logger.warning(
                    f"[LiteAgent] Attempt {attempt + 1}: {last_error}. "
                    f"Raw: {response.content[:100] if 'response' in dir() else 'N/A'}"
                )
                # On retry, add explicit instruction
                if attempt < max_retries:
                    prompt = self._add_retry_instruction(prompt, str(e))

            except ValidationError as e:
                last_error = f"Schema validation: {e.error_count()} errors"
                logger.warning(
                    f"[LiteAgent] Attempt {attempt + 1}: {last_error}"
                )
                if attempt < max_retries:
                    prompt = self._add_retry_instruction(
                        prompt, f"Output must match schema exactly. Errors: {e.errors()[:3]}"
                    )

            except Exception as e:
                last_error = str(e)
                logger.error(f"[LiteAgent] Attempt {attempt + 1} failed: {e}")
                break

        # All attempts failed
        return LiteAgentResult(
            success=False,
            data=None,
            raw_output="",
            model=model,
            retries=max_retries,
            error=last_error,
        )

    def _build_prompt(
        self,
        task: str,
        context: Dict,
        schema: Type[BaseModel],
        examples: Optional[list],
    ) -> str:
        """Build the prompt with task, context, schema, and examples."""
        parts = []

        # Task instruction
        parts.append(f"TASK: {task}")
        parts.append("")

        # Few-shot examples
        if examples:
            parts.append("EXAMPLES:")
            for i, ex in enumerate(examples[:3], 1):
                parts.append(f"Ví dụ {i}:")
                parts.append(f"  Input: {json.dumps(ex.get('input', {}), ensure_ascii=False)}")
                parts.append(f"  Output: {json.dumps(ex.get('output', {}), ensure_ascii=False)}")
            parts.append("")

        # Input context
        parts.append("INPUT:")
        parts.append(json.dumps(context, ensure_ascii=False, indent=2))
        parts.append("")

        # Output schema
        schema_json = schema.model_json_schema()
        # Simplify schema for prompt (just properties + required)
        properties = schema_json.get("properties", {})
        required = schema_json.get("required", [])

        parts.append("OUTPUT FORMAT (respond with valid JSON only):")
        parts.append("{")
        for field_name, field_info in properties.items():
            field_type = field_info.get("type", "string")
            description = field_info.get("description", "")
            req_marker = " (required)" if field_name in required else ""
            parts.append(f'  "{field_name}": <{field_type}>{req_marker}  // {description}')
        parts.append("}")
        parts.append("")
        parts.append("Respond with ONLY valid JSON. No explanation, no markdown.")

        return "\n".join(parts)

    def _add_retry_instruction(self, prompt: str, error: str) -> str:
        """Add retry instruction to prompt after failure."""
        return (
            f"{prompt}\n\n"
            f"IMPORTANT: Previous attempt failed: {error}\n"
            f"Please output ONLY valid JSON matching the schema above."
        )

    def _clean_json(self, content: str) -> str:
        """Clean common JSON formatting issues from LLM output."""
        content = content.strip()

        # Remove markdown code blocks
        if content.startswith("```json"):
            content = content[7:]
        if content.startswith("```"):
            content = content[3:]
        if content.endswith("```"):
            content = content[:-3]

        content = content.strip()

        # Find first { and last }
        start = content.find("{")
        end = content.rfind("}")
        if start != -1 and end != -1:
            content = content[start:end + 1]

        return content
