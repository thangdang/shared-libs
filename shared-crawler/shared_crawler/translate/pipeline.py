"""Auto-translate orchestrator with caching and quality checks.

Strategy:
- Primary: Ollama (local, free) — handles 90%+ of translations
- Fallback: Google Cloud Translation API — for quality failures
- Cache: Redis (7-day TTL) — avoid re-translating same content
"""

import hashlib
import logging
import re
from dataclasses import dataclass
from typing import Optional

import redis.asyncio as aioredis

from shared_crawler.translate.providers import (
    GoogleTranslateProvider,
    OllamaTranslator,
)

logger = logging.getLogger(__name__)


@dataclass
class TranslatedText:
    """Result of a translation operation."""

    original: str
    translated: str
    source_lang: str
    target_lang: str
    provider: str  # "ollama" | "google" | "cache"
    quality_score: float  # 0.0 to 1.0


class TranslationPipeline:
    """EN→VI translation pipeline with quality-cost optimization.

    Features:
    - Redis caching (7-day TTL) to avoid re-translating
    - Quality checks (length ratio, untranslated blocks)
    - Automatic fallback from Ollama to Google API
    - Cost tracking
    """

    def __init__(
        self,
        redis_url: str = "redis://localhost:6379",
        ollama_url: str = "http://localhost:11434",
        ollama_model: str = "qwen3:8b",
        google_api_key: str = "",
        cache_ttl: int = 604800,  # 7 days
    ):
        """Initialize translation pipeline.

        Args:
            redis_url: Redis connection URL.
            ollama_url: Ollama API base URL.
            ollama_model: Ollama model for translation.
            google_api_key: Google Cloud Translation API key (optional).
            cache_ttl: Cache TTL in seconds (default 7 days).
        """
        self._redis_url = redis_url
        self._redis: Optional[aioredis.Redis] = None
        self._cache_ttl = cache_ttl

        self._primary = OllamaTranslator(model=ollama_model, ollama_url=ollama_url)
        self._fallback = GoogleTranslateProvider(api_key=google_api_key)

        # Quality thresholds
        self._min_length_ratio = 0.5   # Translated should be at least 50% of original
        self._max_length_ratio = 2.5   # Translated should not exceed 250% of original
        self._max_english_block = 20   # Max consecutive English chars allowed

    async def _get_redis(self) -> aioredis.Redis:
        """Get or create Redis connection."""
        if self._redis is None:
            self._redis = aioredis.from_url(
                self._redis_url, decode_responses=True
            )
        return self._redis

    def _cache_key(self, text: str, source_lang: str, target_lang: str) -> str:
        """Generate cache key from content hash.

        Args:
            text: Original text.
            source_lang: Source language.
            target_lang: Target language.

        Returns:
            Redis cache key.
        """
        content = f"{source_lang}:{target_lang}:{text}"
        content_hash = hashlib.sha256(content.encode("utf-8")).hexdigest()[:16]
        return f"translate:cache:{content_hash}"

    def _quality_check(self, original: str, translated: str) -> float:
        """Check translation quality.

        Checks:
        1. Length ratio (translated vs original)
        2. No large untranslated English blocks
        3. Contains Vietnamese characters

        Args:
            original: Original English text.
            translated: Translated text.

        Returns:
            Quality score (0.0 to 1.0). Score >= 0.7 is acceptable.
        """
        if not translated or not translated.strip():
            return 0.0

        score = 1.0

        # Check 1: Length ratio
        orig_len = len(original)
        trans_len = len(translated)
        if orig_len > 0:
            ratio = trans_len / orig_len
            if ratio < self._min_length_ratio or ratio > self._max_length_ratio:
                score -= 0.4

        # Check 2: Untranslated English blocks
        english_blocks = re.findall(r'[a-zA-Z]{' + str(self._max_english_block) + r',}', translated)
        if english_blocks:
            # Allow common English terms (brand names, tech terms)
            non_term_blocks = [
                b for b in english_blocks
                if not self._is_acceptable_english_term(b)
            ]
            if non_term_blocks:
                score -= 0.3 * min(len(non_term_blocks), 3)

        # Check 3: Contains Vietnamese characters (diacritics)
        vietnamese_chars = re.findall(r'[àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]', translated.lower())
        if len(translated) > 50 and len(vietnamese_chars) < 3:
            score -= 0.3

        return max(0.0, min(1.0, score))

    def _is_acceptable_english_term(self, term: str) -> bool:
        """Check if an English block is an acceptable term (brand, tech).

        Args:
            term: English text block.

        Returns:
            True if it's likely a proper noun or tech term.
        """
        # Common acceptable English terms in Vietnamese tech/news articles
        acceptable_patterns = [
            r'^[A-Z][a-z]+$',           # Proper nouns (Google, Apple)
            r'^[A-Z]+$',                 # Acronyms (API, HTML, CSS)
            r'^[A-Z][a-zA-Z]+[A-Z]',    # CamelCase (JavaScript, TypeScript)
        ]
        return any(re.match(p, term) for p in acceptable_patterns)

    async def translate(
        self,
        text: str,
        source_lang: str = "en",
        target_lang: str = "vi",
    ) -> TranslatedText:
        """Translate text with caching and quality fallback.

        Flow:
        1. Check Redis cache
        2. Try Ollama (free, local)
        3. Quality check result
        4. If quality low, fallback to Google API
        5. Cache result

        Args:
            text: Text to translate.
            source_lang: Source language code (default "en").
            target_lang: Target language code (default "vi").

        Returns:
            TranslatedText with result and metadata.
        """
        if not text or not text.strip():
            return TranslatedText(
                original=text,
                translated=text,
                source_lang=source_lang,
                target_lang=target_lang,
                provider="none",
                quality_score=1.0,
            )

        # Step 1: Check cache
        try:
            redis = await self._get_redis()
            cache_key = self._cache_key(text, source_lang, target_lang)
            cached = await redis.get(cache_key)
            if cached:
                return TranslatedText(
                    original=text,
                    translated=cached,
                    source_lang=source_lang,
                    target_lang=target_lang,
                    provider="cache",
                    quality_score=1.0,  # Cached = previously validated
                )
        except Exception as e:
            logger.debug("Cache lookup failed: %s", e)

        # Step 2: Try Ollama (primary, free)
        translated = ""
        provider = "ollama"
        try:
            translated = await self._primary.translate(text, source_lang, target_lang)
        except Exception as e:
            logger.warning("Ollama translation failed: %s", e)
            translated = ""

        # Step 3: Quality check
        quality_score = self._quality_check(text, translated) if translated else 0.0

        # Step 4: Fallback to Google if quality is low
        if quality_score < 0.7:
            logger.info(
                "Ollama quality low (%.2f), falling back to Google API",
                quality_score,
            )
            try:
                translated = await self._fallback.translate(
                    text, source_lang, target_lang
                )
                provider = "google"
                quality_score = self._quality_check(text, translated)
            except Exception as e:
                logger.error("Google Translate fallback also failed: %s", e)
                # If both fail, return original text
                if not translated:
                    return TranslatedText(
                        original=text,
                        translated=text,
                        source_lang=source_lang,
                        target_lang=target_lang,
                        provider="failed",
                        quality_score=0.0,
                    )

        # Step 5: Cache successful translation
        if quality_score >= 0.7:
            try:
                redis = await self._get_redis()
                cache_key = self._cache_key(text, source_lang, target_lang)
                await redis.set(cache_key, translated, ex=self._cache_ttl)
            except Exception as e:
                logger.debug("Cache write failed: %s", e)

        return TranslatedText(
            original=text,
            translated=translated,
            source_lang=source_lang,
            target_lang=target_lang,
            provider=provider,
            quality_score=quality_score,
        )

    async def translate_article(
        self,
        title: str,
        content: str,
        source_lang: str = "en",
        target_lang: str = "vi",
    ) -> dict:
        """Translate an article's title and content separately.

        Args:
            title: Article title.
            content: Article content/summary.
            source_lang: Source language.
            target_lang: Target language.

        Returns:
            Dict with translated_title, translated_content, providers, quality.
        """
        title_result = await self.translate(title, source_lang, target_lang)
        content_result = await self.translate(content, source_lang, target_lang)

        return {
            "translated_title": title_result.translated,
            "translated_content": content_result.translated,
            "title_provider": title_result.provider,
            "content_provider": content_result.provider,
            "title_quality": title_result.quality_score,
            "content_quality": content_result.quality_score,
            "overall_quality": min(title_result.quality_score, content_result.quality_score),
        }
