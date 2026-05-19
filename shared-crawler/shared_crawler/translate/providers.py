"""Translation provider adapters.

Supports Ollama (local, free) and Google Cloud Translation API (fallback).
"""

import logging
import os
from abc import ABC, abstractmethod

import httpx

logger = logging.getLogger(__name__)


class BaseTranslator(ABC):
    """Abstract base class for translation providers."""

    @abstractmethod
    async def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate text from source to target language.

        Args:
            text: Text to translate.
            source_lang: Source language code (e.g., "en").
            target_lang: Target language code (e.g., "vi").

        Returns:
            Translated text string.
        """
        ...


class OllamaTranslator(BaseTranslator):
    """Translation using local Ollama LLM (free, unlimited).

    Uses qwen3:8b with an optimized translation prompt.
    """

    def __init__(
        self,
        model: str = "qwen3:8b",
        ollama_url: str = "http://localhost:11434",
    ):
        """Initialize Ollama translator.

        Args:
            model: Ollama model name.
            ollama_url: Ollama API base URL.
        """
        self.model = model
        self.ollama_url = ollama_url

    async def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate using Ollama with optimized prompt.

        Args:
            text: Text to translate.
            source_lang: Source language code.
            target_lang: Target language code.

        Returns:
            Translated text.

        Raises:
            httpx.HTTPError: If Ollama is unreachable.
        """
        prompt = (
            f"Translate the following {source_lang} text to {target_lang}. "
            f"Output ONLY the translation, no explanations or notes.\n\n"
            f"Text: {text}\n\n"
            f"Translation:"
        )

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{self.ollama_url}/api/generate",
                json={
                    "model": self.model,
                    "prompt": prompt,
                    "stream": False,
                    "options": {
                        "temperature": 0.3,  # Low temp for accuracy
                        "num_predict": len(text) * 3,  # Vietnamese can be longer
                    },
                },
            )
            response.raise_for_status()

        result = response.json()
        translated = result.get("response", "").strip()

        # Clean up common artifacts
        translated = translated.removeprefix("Translation:").strip()
        translated = translated.removeprefix("Bản dịch:").strip()

        return translated


class GoogleTranslateProvider(BaseTranslator):
    """Google Cloud Translation API (paid fallback).

    Cost: ~$20 per 1M characters.
    Used only when Ollama quality is insufficient.
    """

    def __init__(self, api_key: str = ""):
        """Initialize Google Translate provider.

        Args:
            api_key: Google Cloud API key. Falls back to
                     GOOGLE_TRANSLATE_API_KEY env var.
        """
        self.api_key = api_key or os.getenv("GOOGLE_TRANSLATE_API_KEY", "")
        self.base_url = "https://translation.googleapis.com/language/translate/v2"

    async def translate(self, text: str, source_lang: str, target_lang: str) -> str:
        """Translate using Google Cloud Translation API.

        Args:
            text: Text to translate.
            source_lang: Source language code (e.g., "en").
            target_lang: Target language code (e.g., "vi").

        Returns:
            Translated text.

        Raises:
            ValueError: If API key is not configured.
            httpx.HTTPError: If API request fails.
        """
        if not self.api_key:
            raise ValueError(
                "Google Translate API key not configured. "
                "Set GOOGLE_TRANSLATE_API_KEY environment variable."
            )

        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                self.base_url,
                params={"key": self.api_key},
                json={
                    "q": text,
                    "source": source_lang,
                    "target": target_lang,
                    "format": "text",
                },
            )
            response.raise_for_status()

        data = response.json()
        translations = data.get("data", {}).get("translations", [])

        if not translations:
            logger.warning("Google Translate returned empty result for text: %s...", text[:50])
            return text  # Return original if translation fails

        return translations[0].get("translatedText", text)
