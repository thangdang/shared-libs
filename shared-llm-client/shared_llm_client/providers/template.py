"""Template-based fallback provider.

Returns pre-defined template responses when all other providers fail.
Marks responses as degraded=True.
"""

import logging
from typing import AsyncIterator

from shared_llm_client.providers.base import BaseProvider, ProviderResponse

logger = logging.getLogger(__name__)

# Default template responses by detected intent
_TEMPLATES = {
    "default": "Xin lỗi, hệ thống AI đang tạm thời không khả dụng. Vui lòng thử lại sau.",
    "greeting": "Xin chào! Hệ thống AI đang bảo trì. Vui lòng thử lại sau ít phút.",
    "error": "Đã xảy ra lỗi khi xử lý yêu cầu. Vui lòng thử lại sau.",
}


class TemplateProvider(BaseProvider):
    """Template-based fallback provider.

    Always available. Returns degraded=True responses.
    """

    def __init__(self, templates: dict | None = None):
        """Initialize template provider.

        Args:
            templates: Custom template dict. Uses defaults if None.
        """
        self._templates = templates or _TEMPLATES

    @property
    def name(self) -> str:
        return "template"

    async def generate(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        timeout: float = 30.0,
        json_mode: bool = False,
    ) -> ProviderResponse:
        """Return a template response.

        Always succeeds. Response is marked as degraded.
        """
        content = self._select_template(prompt, json_mode)

        logger.info("Using template fallback response (all providers unavailable)")

        return ProviderResponse(
            content=content,
            provider=self.name,
            degraded=True,
            usage=None,
        )

    async def stream(
        self,
        prompt: str,
        model: str,
        temperature: float = 0.7,
        max_tokens: int = 2000,
        timeout: float = 30.0,
    ) -> AsyncIterator[str]:
        """Stream template response word by word."""
        content = self._select_template(prompt, json_mode=False)
        # Yield word by word to simulate streaming
        for word in content.split():
            yield word + " "

    async def is_available(self) -> bool:
        """Template provider is always available."""
        return True

    def _select_template(self, prompt: str, json_mode: bool) -> str:
        """Select appropriate template based on prompt content."""
        if json_mode:
            return '{"error": "AI service temporarily unavailable", "degraded": true}'

        prompt_lower = prompt.lower()
        if any(w in prompt_lower for w in ["xin chào", "hello", "hi", "chào"]):
            return self._templates.get("greeting", self._templates["default"])

        return self._templates.get("default", _TEMPLATES["default"])
